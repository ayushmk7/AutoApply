import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../lib/config.js';
import { encryptAtRest, decryptAtRest } from '../lib/cryptoAtRest.js';
import {
  listingDocumentRef,
  userApplicationRef,
  userApplicationsCollection,
  userDocumentRef,
  userGoogleSheetsTokensRef,
} from '../lib/firestorePaths.js';
import { HttpError } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';
import type { ApplicationDocument } from '../types/application.js';
import type { ListingDocument } from '../types/listing.js';
import type { ProfilePreferences } from '../types/profile.js';

function defaultPreferences(): ProfilePreferences {
  return {
    resume_template: 'jakes',
    auto_apply_threshold: 75,
    daily_limit: 20,
    sheets_enabled: false,
    sheets_id: '',
    calendar_connected: false,
    linkedin_connections: [],
  };
}

const HEADER_ROW = [
  'Application ID',
  'Row Version',
  'Last Writer',
  'Conflict State',
  'Conflict Reason',
  'Company',
  'Role',
  'Location',
  'Source',
  'Fit Score',
  'ATS Score',
  'Status',
  'Method',
  'Resume Link',
  'Cover Letter Link',
  'Applied Date',
  'Response',
  'Response Date',
  'Next Action',
  'Notes',
];

type GoogleTokenBundle = {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
};

function sheetsRedirectUri(): string {
  return (
    config.googleSheetsRedirectUri?.replace(/\/$/, '') ??
    `${config.apiBaseUrl.replace(/\/$/, '')}/api/sheets/oauth/callback`
  );
}

function oauth2Client() {
  if (!config.googleOauthClientId || !config.googleOauthClientSecret) {
    throw new HttpError(503, 'Google OAuth is not configured.', 'SERVICE_UNAVAILABLE');
  }
  return new google.auth.OAuth2(
    config.googleOauthClientId,
    config.googleOauthClientSecret,
    sheetsRedirectUri()
  );
}

export async function createSheetsAuthorizationUrl(uid: string): Promise<string> {
  const client = oauth2Client();
  const secret = new TextEncoder().encode(config.oauthStateSecret);
  const state = await new SignJWT({ uid, purpose: 'sheets' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    state,
  });
}

export async function verifySheetsOAuthState(state: string): Promise<string> {
  try {
    const secret = new TextEncoder().encode(config.oauthStateSecret);
    const { payload } = await jwtVerify(state, secret, { algorithms: ['HS256'] });
    const uid = typeof payload.uid === 'string' ? payload.uid : '';
    if (!uid || payload.purpose !== 'sheets') {
      throw new Error('bad_state');
    }
    return uid;
  } catch {
    throw new HttpError(400, 'Invalid or expired OAuth state.', 'VALIDATION_ERROR');
  }
}

async function loadTokensJson(db: Firestore, uid: string): Promise<GoogleTokenBundle | null> {
  const ref = userGoogleSheetsTokensRef(db, uid);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const c = (snap.data() as { ciphertext?: string }).ciphertext;
  if (!c) return null;
  try {
    return JSON.parse(decryptAtRest(c)) as GoogleTokenBundle;
  } catch (err) {
    logger.warn({ err, uid }, 'google_sheets_token_decrypt_failed');
    return null;
  }
}

async function saveTokensJson(db: Firestore, uid: string, tokens: GoogleTokenBundle): Promise<void> {
  const ciphertext = encryptAtRest(JSON.stringify(tokens));
  await userGoogleSheetsTokensRef(db, uid).set(
    {
      ciphertext,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getAuthorizedSheetsClient(
  db: Firestore,
  uid: string,
  requestId: string
): Promise<{ auth: InstanceType<typeof google.auth.OAuth2>; spreadsheetId: string } | null> {
  const userRef = userDocumentRef(db, uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return null;
  const data = userSnap.data() as {
    preferences?: ProfilePreferences;
    sheets_sync_error?: string;
  };
  const prefs = data.preferences;
  if (!prefs?.sheets_enabled || !prefs.sheets_id?.trim()) {
    return null;
  }

  let tokens = await loadTokensJson(db, uid);
  if (!tokens?.refresh_token && !tokens?.access_token) {
    await disableSheetsIntegration(db, uid, 'missing_oauth_tokens');
    return null;
  }

  const client = oauth2Client();
  client.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });

  try {
    if (tokens.expiry_date && tokens.expiry_date < Date.now() + 60_000) {
      const { credentials } = await client.refreshAccessToken();
      const next: GoogleTokenBundle = {
        ...tokens,
        access_token: credentials.access_token ?? tokens.access_token,
        refresh_token: credentials.refresh_token ?? tokens.refresh_token,
        scope: credentials.scope ?? tokens.scope,
        token_type: credentials.token_type ?? tokens.token_type,
        expiry_date: credentials.expiry_date ?? tokens.expiry_date,
      };
      await saveTokensJson(db, uid, next);
      tokens = next;
      client.setCredentials({
        access_token: next.access_token ?? undefined,
        refresh_token: next.refresh_token ?? undefined,
        scope: next.scope ?? undefined,
        token_type: next.token_type ?? undefined,
        expiry_date: next.expiry_date ?? undefined,
      });
    }
  } catch (err) {
    logger.warn({ err, uid, requestId }, 'google_sheets_refresh_failed');
    await disableSheetsIntegration(db, uid, 'token_refresh_failed');
    return null;
  }

  return { auth: client, spreadsheetId: prefs.sheets_id.trim() };
}

export async function disableSheetsIntegration(
  db: Firestore,
  uid: string,
  reason?: string
): Promise<void> {
  const ref = userDocumentRef(db, uid);
  await userGoogleSheetsTokensRef(db, uid).delete().catch(() => {});
  const snap = await ref.get();
  const data = snap.data() as { preferences?: Partial<ProfilePreferences> } | undefined;
  const prefs: ProfilePreferences = { ...defaultPreferences(), ...(data?.preferences ?? {}) };
  prefs.sheets_enabled = false;
  prefs.sheets_id = '';
  await ref.set(
    {
      preferences: prefs,
      sheets_sync_error: reason ?? 'disabled',
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createTrackingSheet(
  auth: InstanceType<typeof google.auth.OAuth2>
): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'AutoApply - Application Tracker' },
      sheets: [{ properties: { title: 'Applications' } }],
    },
  });
  const id = res.data.spreadsheetId;
  if (!id) {
    throw new HttpError(502, 'Google Sheets did not return a spreadsheet id.', 'SHEETS_CREATE_FAILED');
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: 'Applications!A1:O1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [HEADER_ROW] },
  });
  return id;
}

function formatTs(v: unknown): string {
  if (!v) return '';
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return '';
    }
  }
  return '';
}

function getNextAction(app: ApplicationDocument): string {
  switch (app.status) {
    case 'interview_scheduled':
      return 'Prepare for interview';
    case 'waiting':
      return 'Await employer reply';
    case 'applied':
    case 'emailed':
      return 'Follow up if no response';
    case 'manual_needed':
      return 'Complete manual steps';
    default:
      return '';
  }
}

async function rowForApplication(
  db: Firestore,
  uid: string,
  app: ApplicationDocument
): Promise<string[]> {
  const listSnap = await listingDocumentRef(db, app.listing_id).get();
  const listing = listSnap.exists
    ? ({ id: listSnap.id, ...(listSnap.data() as object) } as ListingDocument)
    : null;

  return [
    app.id,
    String(app.sheets_row_version ?? 0),
    'firestore',
    app.sheets_conflict_state ?? 'clean',
    app.sheets_conflict_reason ?? '',
    listing?.company ?? '',
    listing?.role ?? '',
    listing?.location ?? '',
    listing?.source ?? '',
    String(app.fit_score ?? ''),
    String(app.ats_score ?? ''),
    app.status ?? '',
    app.method ?? '',
    app.resume_url ?? '',
    app.cover_letter_url ?? '',
    formatTs(app.applied_date),
    app.response_type ?? '',
    formatTs(app.response_date),
    getNextAction(app),
    app.user_notes ?? '',
  ];
}

export function parseRowVersion(value: unknown): number {
  const n = Number(String(value ?? '').trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function parseSheetStatus(value: unknown): ApplicationDocument['status'] | undefined {
  const v = String(value ?? '').trim();
  if (!v) return undefined;
  const allowed: ApplicationDocument['status'][] = [
    'queued',
    'applying',
    'applied',
    'emailed',
    'waiting',
    'rejected_auto',
    'rejected_review',
    'interview_scheduled',
    'thank_you_sent',
    'followup_sent',
    'offer',
    'accepted',
    'declined',
    'manual_needed',
  ];
  return allowed.includes(v as ApplicationDocument['status']) ? (v as ApplicationDocument['status']) : undefined;
}

async function pullSheetEditsIntoFirestore(
  db: Firestore,
  uid: string,
  spreadsheetId: string,
  auth: InstanceType<typeof google.auth.OAuth2>,
  requestId: string
): Promise<void> {
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Applications!A2:T10000',
  });
  const rows = res.data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const applicationId = String(row[0] ?? '').trim();
    if (!applicationId) continue;
    const rowVersion = parseRowVersion(row[1]);
    const statusFromSheet = parseSheetStatus(row[11]);
    const notesFromSheet = String(row[19] ?? '').trim();
    const appRef = userApplicationRef(db, uid, applicationId);
    const snap = await appRef.get();
    if (!snap.exists) continue;
    const app = { id: snap.id, ...(snap.data() as object) } as ApplicationDocument;
    const fsVersion = Number(app.sheets_row_version ?? 0);
    if (rowVersion < fsVersion) {
      await appRef.set(
        {
          sheets_conflict_state: 'conflict',
          sheets_conflict_reason: 'sheet_version_stale',
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      continue;
    }
    if (rowVersion === fsVersion) continue;
    const patch: Record<string, unknown> = {
      sheets_row_version: rowVersion,
      sheets_conflict_state: 'clean',
      sheets_conflict_reason: FieldValue.delete(),
      sheets_last_sync_direction: 'sheet_to_firestore',
      sheets_last_sync_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };
    if (statusFromSheet && statusFromSheet !== app.status) {
      patch.status = statusFromSheet;
    }
    if (notesFromSheet !== String(app.user_notes ?? '')) {
      patch.user_notes = notesFromSheet;
    }
    await appRef.set(patch, { merge: true });
    logger.info({ uid, applicationId, requestId }, 'google_sheets_sheet_to_firestore_applied');
  }
}

export async function fullSyncUserSheet(
  db: Firestore,
  uid: string,
  requestId: string
): Promise<void> {
  const ctx = await getAuthorizedSheetsClient(db, uid, requestId);
  if (!ctx) {
    throw new HttpError(400, 'Google Sheets is not enabled or tokens are invalid.', 'SHEETS_NOT_ENABLED');
  }

  const { auth, spreadsheetId } = ctx;
  const sheets = google.sheets({ version: 'v4', auth });

  const appsSnap = await userApplicationsCollection(db, uid).get();
  const apps = appsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as ApplicationDocument));
  apps.sort((a, b) => {
    const ca = (a.created_at as Timestamp | undefined)?.toMillis?.() ?? 0;
    const cb = (b.created_at as Timestamp | undefined)?.toMillis?.() ?? 0;
    return ca - cb;
  });

  const rows: string[][] = [];
  for (const app of apps) {
    rows.push(await rowForApplication(db, uid, app));
  }

  try {
    await pullSheetEditsIntoFirestore(db, uid, spreadsheetId, auth, requestId).catch((err) => {
      logger.warn({ err, uid, requestId }, 'google_sheets_pull_sheet_edits_failed');
    });
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Applications!A2:T10000',
    });

    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Applications!A2:T${1 + rows.length}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows },
      });
    }

    let rowNum = 2;
    const batch = db.batch();
    for (const app of apps) {
      batch.set(
        userApplicationRef(db, uid, app.id),
        {
          sheets_row: rowNum,
          sheets_row_id: app.id,
          sheets_row_version: Number(app.sheets_row_version ?? 0) + 1,
          sheets_conflict_state: 'clean',
          sheets_conflict_reason: FieldValue.delete(),
          sheets_last_sync_direction: 'firestore_to_sheet',
          sheets_last_sync_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      rowNum++;
    }
    await batch.commit();

    await userDocumentRef(db, uid).set(
      {
        sheets_last_sync_at: FieldValue.serverTimestamp(),
        sheets_sync_error: FieldValue.delete(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'sync_failed';
    logger.warn({ err, uid, requestId }, 'google_sheets_full_sync_failed');
    const code = err && typeof err === 'object' && 'code' in err ? Number((err as { code: number }).code) : 0;
    if (code === 404) {
      await disableSheetsIntegration(db, uid, 'spreadsheet_not_found');
    }
    await userDocumentRef(db, uid).set(
      {
        sheets_sync_error: msg.slice(0, 500),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    throw new HttpError(502, 'Google Sheets sync failed.', 'SHEETS_SYNC_FAILED', { reason: msg });
  }
}

export async function updateSheetRowForApplication(
  db: Firestore,
  uid: string,
  applicationId: string,
  requestId: string
): Promise<void> {
  const ctx = await getAuthorizedSheetsClient(db, uid, requestId);
  if (!ctx) return;

  const appSnap = await userApplicationRef(db, uid, applicationId).get();
  if (!appSnap.exists) return;
  const app = { id: appSnap.id, ...(appSnap.data() as object) } as ApplicationDocument;
  const rowIndex = app.sheets_row;
  if (!rowIndex || rowIndex < 2) {
    await fullSyncUserSheet(db, uid, requestId).catch(() => {});
    return;
  }

  const values = [await rowForApplication(db, uid, app)];
  const sheets = google.sheets({ version: 'v4', auth: ctx.auth });
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: ctx.spreadsheetId,
      range: `Applications!A${rowIndex}:T${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    await userApplicationRef(db, uid, applicationId).set(
      {
        sheets_row_version: Number(app.sheets_row_version ?? 0) + 1,
        sheets_conflict_state: 'clean',
        sheets_conflict_reason: FieldValue.delete(),
        sheets_last_sync_direction: 'firestore_to_sheet',
        sheets_last_sync_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await userDocumentRef(db, uid).set(
      {
        sheets_last_sync_at: FieldValue.serverTimestamp(),
        sheets_sync_error: FieldValue.delete(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    logger.warn({ err, uid, requestId, applicationId }, 'google_sheets_row_update_failed');
    await fullSyncUserSheet(db, uid, requestId).catch(() => {});
  }
}

export async function appendApplicationRowIfEnabled(
  db: Firestore,
  uid: string,
  applicationId: string,
  requestId: string
): Promise<void> {
  const ctx = await getAuthorizedSheetsClient(db, uid, requestId);
  if (!ctx) return;

  const appSnap = await userApplicationRef(db, uid, applicationId).get();
  if (!appSnap.exists) return;
  const app = { id: appSnap.id, ...(appSnap.data() as object) } as ApplicationDocument;
  const row = await rowForApplication(db, uid, app);
  const sheets = google.sheets({ version: 'v4', auth: ctx.auth });

  try {
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: ctx.spreadsheetId,
      range: 'Applications!A:T',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
    const updated = res.data.updates?.updatedRange ?? '';
    const m = /![A-Za-z]+(\d+)/.exec(updated);
    const rowNum = m ? Number.parseInt(m[1], 10) : undefined;
    if (rowNum) {
      await userApplicationRef(db, uid, applicationId).set(
        {
          sheets_row: rowNum,
          sheets_row_id: applicationId,
          sheets_row_version: Number(app.sheets_row_version ?? 0) + 1,
          sheets_conflict_state: 'clean',
          sheets_conflict_reason: FieldValue.delete(),
          sheets_last_sync_direction: 'firestore_to_sheet',
          sheets_last_sync_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await userDocumentRef(db, uid).set(
      {
        sheets_last_sync_at: FieldValue.serverTimestamp(),
        sheets_sync_error: FieldValue.delete(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    logger.warn({ err, uid, requestId }, 'google_sheets_append_failed');
  }
}

export async function completeSheetsOAuthAndEnable(
  db: Firestore,
  uid: string,
  code: string
): Promise<{ spreadsheet_id: string }> {
  const client = oauth2Client();
  let tokens: GoogleTokenBundle;
  try {
    const tr = await client.getToken(code);
    tokens = tr.tokens as GoogleTokenBundle;
  } catch (err) {
    logger.warn({ err, uid }, 'google_sheets_oauth_exchange_failed');
    throw new HttpError(400, 'OAuth code exchange failed.', 'OAUTH_EXCHANGE_FAILED');
  }

  await saveTokensJson(db, uid, tokens);
  client.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });

  const userRef = userDocumentRef(db, uid);
  const snap = await userRef.get();
  const data = snap.data() as { preferences?: Partial<ProfilePreferences> } | undefined;
  const prefs: ProfilePreferences = { ...defaultPreferences(), ...(data?.preferences ?? {}) };

  let sheetId = prefs.sheets_id?.trim() ?? '';
  if (!sheetId) {
    sheetId = await createTrackingSheet(client);
  }

  prefs.sheets_enabled = true;
  prefs.sheets_id = sheetId;

  await userRef.set(
    {
      preferences: prefs,
      sheets_sync_error: FieldValue.delete(),
      sheets_last_sync_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { spreadsheet_id: sheetId };
}
