import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { config } from '../lib/config.js';
import { HttpError } from '../lib/httpError.js';
import {
  listingDocumentRef,
  userApplicationRef,
  userApplicationsCollection,
} from '../lib/firestorePaths.js';
import { enqueueApplyJob, getApplyQueue } from '../queues/producers.js';
import type { ApplyJobData } from '../queues/jobTypes.js';
import { jsonSafeFirestore, jsonSafeValue } from './firestoreJson.js';
import { getBucket, signedReadUrlForObject } from './gcs.js';
import type { ApplicationDocument, ApplicationStatus } from '../types/application.js';

const NOTES_MAX_LEN = 8000;
const SIGNED_URL_TTL_SECONDS = 900;

export const applicationsListQuerySchema = z.object({
  status: z.string().optional(),
  method: z.enum(['ats', 'email', 'both']).optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'fit_score']).optional().default('created_at'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ApplicationsListQuery = z.infer<typeof applicationsListQuerySchema>;

export const applicationNotesBodySchema = z.object({
  notes: z.string().max(NOTES_MAX_LEN),
});

function docToApplication(id: string, data: Record<string, unknown>): ApplicationDocument {
  return { id, ...(data as object) } as ApplicationDocument;
}

function sortKey(
  app: ApplicationDocument,
  sortBy: ApplicationsListQuery['sort_by']
): number {
  const ts = (k: keyof ApplicationDocument) => {
    const v = app[k];
    if (v && typeof v === 'object' && 'toMillis' in v && typeof (v as { toMillis: () => number }).toMillis === 'function') {
      return (v as { toMillis: () => number }).toMillis();
    }
    return 0;
  };
  if (sortBy === 'updated_at') return ts('updated_at');
  if (sortBy === 'fit_score') return -(app.fit_score ?? 0);
  return ts('created_at');
}

export async function listApplications(
  db: Firestore,
  uid: string,
  query: ApplicationsListQuery
): Promise<{ applications: Record<string, unknown>[]; total: number }> {
  const col = userApplicationsCollection(db, uid);
  const snap = await col.get();
  let rows: ApplicationDocument[] = snap.docs.map((d) => docToApplication(d.id, d.data() as Record<string, unknown>));

  if (query.status?.trim()) {
    const s = query.status.trim();
    rows = rows.filter((a) => a.status === s);
  }
  if (query.method) {
    rows = rows.filter((a) => a.method === query.method);
  }

  rows.sort((a, b) => sortKey(b, query.sort_by) - sortKey(a, query.sort_by));

  const total = rows.length;
  const start = (query.page - 1) * query.limit;
  const pageRows = rows.slice(start, start + query.limit);
  const applications = pageRows.map((a) => jsonSafeFirestore(a as unknown as Record<string, unknown>));
  return { applications, total };
}

export async function getApplicationDetail(
  db: Firestore,
  uid: string,
  applicationId: string
): Promise<{ application: Record<string, unknown>; listing: Record<string, unknown> | null }> {
  const ref = userApplicationRef(db, uid, applicationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }
  const app = docToApplication(snap.id, snap.data() as Record<string, unknown>);
  if (app.user_id && app.user_id !== uid) {
    throw new HttpError(403, 'Forbidden.', 'FORBIDDEN');
  }

  const listRef = listingDocumentRef(db, app.listing_id);
  const listSnap = await listRef.get();
  const listing = listSnap.exists
    ? jsonSafeFirestore({ id: listSnap.id, ...(listSnap.data() as object) } as Record<string, unknown>)
    : null;

  return {
    application: jsonSafeFirestore(app as unknown as Record<string, unknown>),
    listing,
  };
}

function normalizeGcsObjectPath(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith('gs://')) {
    const without = t.slice('gs://'.length);
    const slash = without.indexOf('/');
    if (slash === -1) return null;
    return without.slice(slash + 1);
  }
  if (t.startsWith('http://') || t.startsWith('https://')) {
    return null;
  }
  return t;
}

export async function getApplicationArtifactSignedUrl(
  db: Firestore,
  uid: string,
  applicationId: string,
  kind: 'resume' | 'cover-letter' | 'screenshot'
): Promise<{ url: string; expires_at: string }> {
  if (!config.gcsBucket) {
    throw new HttpError(503, 'Object storage is not configured.', 'SERVICE_UNAVAILABLE');
  }

  const ref = userApplicationRef(db, uid, applicationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }
  const app = docToApplication(snap.id, snap.data() as Record<string, unknown>);
  if (app.user_id && app.user_id !== uid) {
    throw new HttpError(403, 'Forbidden.', 'FORBIDDEN');
  }

  let rawPath = '';
  if (kind === 'resume') rawPath = app.resume_url ?? '';
  else if (kind === 'cover-letter') rawPath = app.cover_letter_url ?? '';
  else rawPath = app.submission_screenshot ?? '';

  const path = normalizeGcsObjectPath(rawPath);
  if (!path) {
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      return { url: rawPath, expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString() };
    }
    throw new HttpError(404, 'Artifact is not available yet.', 'ARTIFACT_NOT_READY');
  }

  const file = getBucket().file(path);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpError(404, 'Artifact is not available yet.', 'ARTIFACT_NOT_READY');
  }

  const signed = await signedReadUrlForObject(path, SIGNED_URL_TTL_SECONDS);
  return { url: signed.url, expires_at: signed.expiresAt };
}

async function hasInflightApplyJob(uid: string, applicationId: string): Promise<boolean> {
  if (!config.redisUrl) return false;
  const q = getApplyQueue();
  const states = ['active', 'waiting', 'delayed'] as const;
  for (const state of states) {
    const jobs = await q.getJobs([state], 0, 300);
    for (const j of jobs) {
      const d = j.data as ApplyJobData;
      if (d?.uid === uid && d?.applicationId === applicationId) return true;
    }
  }
  return false;
}

const RETRYABLE: ApplicationStatus[] = ['manual_needed', 'rejected_auto'];

export async function retryApplication(
  db: Firestore,
  uid: string,
  applicationId: string,
  requestId: string
): Promise<{ requeued: boolean }> {
  if (!config.redisUrl) {
    throw new HttpError(503, 'Worker queue is unavailable.', 'SERVICE_UNAVAILABLE');
  }

  const ref = userApplicationRef(db, uid, applicationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }
  const app = docToApplication(snap.id, snap.data() as Record<string, unknown>);

  if (!RETRYABLE.includes(app.status)) {
    throw new HttpError(
      409,
      'Application cannot be retried in its current state.',
      'CONFLICT',
      { status: app.status }
    );
  }

  if (await hasInflightApplyJob(uid, applicationId)) {
    throw new HttpError(409, 'An apply job is already queued or running for this application.', 'CONFLICT');
  }

  await ref.set(
    {
      status: 'queued',
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await enqueueApplyJob(
    {
      uid,
      applicationId,
      listingId: app.listing_id,
      force_manual_submit: false,
    },
    requestId
  );

  return { requeued: true };
}

export async function manualDoneApplication(
  db: Firestore,
  uid: string,
  applicationId: string
): Promise<{ status: ApplicationStatus }> {
  const ref = userApplicationRef(db, uid, applicationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }
  const app = docToApplication(snap.id, snap.data() as Record<string, unknown>);

  if (app.status !== 'manual_needed') {
    throw new HttpError(
      409,
      'Only applications in manual_needed state can be marked completed.',
      'CONFLICT',
      { status: app.status }
    );
  }

  await ref.set(
    {
      status: 'applied',
      applied_date: FieldValue.serverTimestamp(),
      manual_reason: FieldValue.delete(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { status: 'applied' };
}

export async function updateApplicationNotes(
  db: Firestore,
  uid: string,
  applicationId: string,
  notes: string
): Promise<{ user_notes: string }> {
  const ref = userApplicationRef(db, uid, applicationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }

  await ref.set(
    {
      user_notes: notes,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { user_notes: notes };
}

export function toMillis(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'object' && v !== null && 'toMillis' in v && typeof (v as { toMillis: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return null;
}

export { NOTES_MAX_LEN, SIGNED_URL_TTL_SECONDS };
