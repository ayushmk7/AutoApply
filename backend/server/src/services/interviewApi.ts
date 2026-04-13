import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { google } from 'googleapis';
import { HttpError } from '../lib/httpError.js';
import { listingDocumentRef, userApplicationRef, userDocumentRef } from '../lib/firestorePaths.js';
import type { AgentMailAttachment } from './agentmailSend.js';
import { sendAgentMailOutbound } from './agentmailSend.js';
import { downloadObjectBuffer } from './gcs.js';
import {
  claudeDraftFollowUpEmail,
  claudeDraftInterviewConfirmation,
  claudeDraftThankYouEmail,
  claudeInterviewPrepPack,
} from './claudeInterview.js';
import { toMillis } from './applicationsApi.js';
import type { ApplicationDocument, ApplicationStatus } from '../types/application.js';
import type { ListingDocument } from '../types/listing.js';
import { config } from '../lib/config.js';
import { getAuthorizedSheetsClient, updateSheetRowForApplication } from './googleSheetsSync.js';
import { emitUserFeed } from './feedEmit.js';
import { enqueueInterviewFollowupJob, getInterviewFollowupQueue } from '../queues/producers.js';

export const confirmInterviewBodySchema = z.object({
  selected_time: z.string().min(1),
});

export const interviewNotesBodySchema = z.object({
  notes: z.string().min(1).max(16_000),
});

function docToApplication(id: string, data: Record<string, unknown>): ApplicationDocument {
  return { id, ...(data as object) } as ApplicationDocument;
}

async function resumePdfAttachments(app: ApplicationDocument): Promise<AgentMailAttachment[] | undefined> {
  const raw = (app.resume_url ?? '').trim();
  if (!raw || raw.startsWith('http://') || raw.startsWith('https://')) return undefined;
  let path = raw;
  if (raw.startsWith('gs://')) {
    const without = raw.slice('gs://'.length);
    const i = without.indexOf('/');
    if (i === -1) return undefined;
    path = without.slice(i + 1);
  }
  const buf = await downloadObjectBuffer(path);
  if (!buf) return undefined;
  return [{ filename: 'resume.pdf', contentType: 'application/pdf', content: buf }];
}

function pickRecruiterEmail(listing: ListingDocument): string | null {
  for (const c of listing.apollo_contacts ?? []) {
    const e = c.email?.trim();
    if (e && e.includes('@')) return e;
  }
  return null;
}

const CONFIRM_FROM: ApplicationStatus[] = ['waiting', 'emailed', 'applied', 'interview_scheduled'];
const FOLLOWUP_JOB_PREFIX = 'interview-followup';

function nowIso(): string {
  return new Date().toISOString();
}

function appendFollowupAudit(
  app: ApplicationDocument,
  action: 'scheduled' | 'cancelled' | 'sent' | 'skipped',
  requestId: string,
  reason?: string
): Array<{ at: string; action: 'scheduled' | 'cancelled' | 'sent' | 'skipped'; reason?: string; request_id?: string }> {
  const current = Array.isArray(app.followup_audit) ? app.followup_audit.slice(-9) : [];
  current.push({
    at: nowIso(),
    action,
    reason: reason?.slice(0, 200),
    request_id: requestId,
  });
  return current;
}

async function cancelFollowupJobIfExists(uid: string, applicationId: string): Promise<void> {
  if (!config.redisUrl) return;
  const q = getInterviewFollowupQueue();
  const jobId = `${FOLLOWUP_JOB_PREFIX}:${uid}:${applicationId}`;
  await q.remove(jobId).catch(() => {});
}

async function markFollowupCancelled(
  db: Firestore,
  uid: string,
  applicationId: string,
  requestId: string,
  reason: string
): Promise<void> {
  const appRef = userApplicationRef(db, uid, applicationId);
  const snap = await appRef.get();
  if (!snap.exists) return;
  const app = docToApplication(snap.id, snap.data() as Record<string, unknown>);
  await cancelFollowupJobIfExists(uid, applicationId);
  await appRef.set(
    {
      followup_state: 'cancelled',
      followup_cancel_reason: reason.slice(0, 200),
      followup_due_at: FieldValue.delete(),
      followup_audit: appendFollowupAudit(app, 'cancelled', requestId, reason),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function parseIsoOffset(s: string): Date {
  const hasTz = /(Z|[+-]\d{2}:\d{2})$/.test(s.trim());
  if (!hasTz) {
    throw new HttpError(
      400,
      'selected_time must include timezone offset (for example 2026-04-12T14:30:00-04:00).',
      'VALIDATION_ERROR'
    );
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new HttpError(400, 'selected_time must be a valid ISO-8601 datetime.', 'VALIDATION_ERROR');
  }
  return d;
}

async function tryCreateCalendarEvent(
  db: Firestore,
  uid: string,
  selected: Date,
  listing: ListingDocument,
  requestId: string
): Promise<{ created: boolean; eventId?: string; eventUrl?: string; error?: string }> {
  try {
    const authCtx = await getAuthorizedSheetsClient(db, uid, requestId);
    if (!authCtx) return { created: false, error: 'calendar_not_connected' };
    const auth = authCtx.auth;
    const cal = google.calendar({ version: 'v3', auth });
    const startIso = selected.toISOString();
    const endIso = new Date(selected.getTime() + 30 * 60_000).toISOString();
    const res = await cal.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `Interview — ${listing.company ?? 'Company'} — ${listing.role ?? 'Role'}`,
        description: `Scheduled from AutoApply\nListing URL: ${listing.url}`,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
      },
    });
    return {
      created: true,
      eventId: res.data.id ?? undefined,
      eventUrl: res.data.htmlLink ?? undefined,
    };
  } catch (err) {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'calendar_create_failed';
    return { created: false, error: msg.slice(0, 300) };
  }
}

/**
 * Phase 12 — confirm interview: Claude draft → AgentMail send → status (calendar stub).
 */
export async function confirmInterview(
  db: Firestore,
  uid: string,
  applicationId: string,
  selectedTimeRaw: string,
  requestId: string
): Promise<{ confirmation_sent: boolean; calendar_event_created: boolean }> {
  const selected = parseIsoOffset(selectedTimeRaw);

  const appRef = userApplicationRef(db, uid, applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }
  const app = docToApplication(appSnap.id, appSnap.data() as Record<string, unknown>);

  const existingInterviewMs = toMillis(app.interview_date);
  if (
    app.status === 'interview_scheduled' &&
    existingInterviewMs !== null &&
    Math.abs(existingInterviewMs - selected.getTime()) < 120_000
  ) {
    return { confirmation_sent: true, calendar_event_created: false };
  }

  if (!CONFIRM_FROM.includes(app.status)) {
    throw new HttpError(
      409,
      'Interview cannot be confirmed for this application state.',
      'CONFLICT',
      { status: app.status }
    );
  }

  const listSnap = await listingDocumentRef(db, app.listing_id).get();
  if (!listSnap.exists) {
    throw new HttpError(404, 'Listing not found for application.', 'NOT_FOUND');
  }
  const listing = { id: listSnap.id, ...(listSnap.data() as object) } as ListingDocument;

  const to = pickRecruiterEmail(listing);
  if (!to) {
    throw new HttpError(
      400,
      'No recruiter email on file for this listing; add Apollo enrichment or paste a contact.',
      'NO_RECIPIENT_EMAIL'
    );
  }

  const userSnap = await userDocumentRef(db, uid).get();
  const userData = (userSnap.data() ?? {}) as { agentmail_address?: string; email?: string };
  const inboxId = userData.agentmail_address?.trim();
  if (!inboxId) {
    throw new HttpError(400, 'AgentMail inbox is not provisioned for this user.', 'AGENTMAIL_NOT_READY');
  }

  const draft = await claudeDraftInterviewConfirmation(
    listing,
    selected.toISOString(),
    userData.email?.trim() || 'Candidate',
    requestId
  );

  const attachments = await resumePdfAttachments(app);
  const send = await sendAgentMailOutbound({
    inboxId,
    to,
    subject: draft.subject,
    text: draft.text,
    html: draft.html,
    requestId,
    idempotencyKey: `confirm-interview:${uid}:${applicationId}:${selected.getTime()}`,
    attachments,
  });

  if (!send.ok) {
    throw new HttpError(502, 'Failed to send confirmation email.', 'EMAIL_SEND_FAILED', {
      reason: send.error,
    });
  }

  const cal = await tryCreateCalendarEvent(db, uid, selected, listing, requestId);

  await appRef.set(
    {
      status: 'interview_scheduled',
      interview_date: Timestamp.fromDate(selected),
      followup_state: 'cancelled',
      followup_cancel_reason: 'interview_confirmed',
      followup_due_at: FieldValue.delete(),
      calendar_event_id: cal.eventId ?? FieldValue.delete(),
      calendar_event_url: cal.eventUrl ?? FieldValue.delete(),
      calendar_sync_error: cal.created ? FieldValue.delete() : cal.error ?? 'calendar_not_connected',
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await emitUserFeed(
    uid,
    {
      action: 'interview_scheduled',
      application_id: applicationId,
      listing_id: listing.id,
      detail: cal.created
        ? 'Interview confirmed and calendar event created.'
        : 'Interview confirmed; calendar event not created.',
      code: cal.created ? 'INTERVIEW_CONFIRMED' : 'CALENDAR_NOT_CONNECTED',
    },
    requestId,
    { company: listing.company, role: listing.role }
  );

  await markFollowupCancelled(db, uid, applicationId, requestId, 'interview_confirmed');
  void updateSheetRowForApplication(db, uid, applicationId, requestId).catch(() => {});

  return {
    confirmation_sent: true,
    calendar_event_created: cal.created,
  };
}

/** Google Calendar create is Phase 15 territory; PRD allows `calendar_event_created: false` when disconnected. */
export async function getInterviewPrep(
  db: Firestore,
  uid: string,
  applicationId: string,
  requestId: string
): Promise<{ prep: Awaited<ReturnType<typeof claudeInterviewPrepPack>> }> {
  const appRef = userApplicationRef(db, uid, applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }
  const app = docToApplication(appSnap.id, appSnap.data() as Record<string, unknown>);

  const listSnap = await listingDocumentRef(db, app.listing_id).get();
  if (!listSnap.exists) {
    throw new HttpError(404, 'Listing not found for application.', 'NOT_FOUND');
  }
  const listing = { id: listSnap.id, ...(listSnap.data() as object) } as ListingDocument;

  const resumeHint = [
    `ATS score: ${app.ats_score}`,
    `Fit score: ${app.fit_score}`,
    `Matched keywords: ${(app.ats_keywords_matched ?? []).slice(0, 12).join(', ')}`,
  ].join('\n');

  const prep = await claudeInterviewPrepPack(listing, resumeHint, requestId);
  return { prep };
}

export async function submitInterviewNotes(
  db: Firestore,
  uid: string,
  applicationId: string,
  notes: string
): Promise<{ interview_notes: string }> {
  const ref = userApplicationRef(db, uid, applicationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }
  const prev = String((snap.data() as { interview_notes?: string }).interview_notes ?? '').trim();
  const stamp = new Date().toISOString();
  const block = prev ? `${prev}\n\n[${stamp}]\n${notes}` : `[${stamp}]\n${notes}`;

  await ref.set(
    {
      interview_notes: block,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { interview_notes: block };
}

export async function sendThankYouEmail(
  db: Firestore,
  uid: string,
  applicationId: string,
  requestId: string
): Promise<{ sent: boolean }> {
  const appRef = userApplicationRef(db, uid, applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }
  const app = docToApplication(appSnap.id, appSnap.data() as Record<string, unknown>);

  if (app.status !== 'interview_scheduled') {
    throw new HttpError(
      409,
      'Thank-you can only be sent after an interview is scheduled.',
      'CONFLICT',
      { status: app.status }
    );
  }

  if (toMillis(app.thank_you_sent)) {
    return { sent: true };
  }

  const listSnap = await listingDocumentRef(db, app.listing_id).get();
  if (!listSnap.exists) {
    throw new HttpError(404, 'Listing not found for application.', 'NOT_FOUND');
  }
  const listing = { id: listSnap.id, ...(listSnap.data() as object) } as ListingDocument;

  const to = pickRecruiterEmail(listing);
  if (!to) {
    throw new HttpError(400, 'No recruiter email on file for this listing.', 'NO_RECIPIENT_EMAIL');
  }

  const userSnap = await userDocumentRef(db, uid).get();
  const inboxId = (userSnap.data() as { agentmail_address?: string } | undefined)?.agentmail_address?.trim();
  if (!inboxId) {
    throw new HttpError(400, 'AgentMail inbox is not provisioned for this user.', 'AGENTMAIL_NOT_READY');
  }

  const draft = await claudeDraftThankYouEmail(listing, requestId);
  const attachments = await resumePdfAttachments(app);
  const send = await sendAgentMailOutbound({
    inboxId,
    to,
    subject: draft.subject,
    text: draft.text,
    html: draft.html,
    requestId,
    idempotencyKey: `thankyou:${uid}:${applicationId}`,
    attachments,
  });

  if (!send.ok) {
    throw new HttpError(502, 'Failed to send thank-you email.', 'EMAIL_SEND_FAILED', { reason: send.error });
  }

  const followupDue = Timestamp.fromMillis(Date.now() + 5 * 24 * 60 * 60 * 1000);

  await appRef.set(
    {
      status: 'thank_you_sent',
      thank_you_sent: FieldValue.serverTimestamp(),
      followup_due_at: followupDue,
      followup_job_id: `${FOLLOWUP_JOB_PREFIX}:${uid}:${applicationId}`,
      followup_state: 'scheduled',
      followup_cancel_reason: FieldValue.delete(),
      followup_audit: appendFollowupAudit(app, 'scheduled', requestId),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await emitUserFeed(
    uid,
    {
      action: 'emailed',
      application_id: applicationId,
      listing_id: listing.id,
      detail: 'Thank-you email sent.',
      code: 'THANK_YOU_SENT',
    },
    requestId,
    { company: listing.company, role: listing.role }
  );

  void updateSheetRowForApplication(db, uid, applicationId, requestId).catch(() => {});

  if (config.redisUrl) {
    await enqueueInterviewFollowupJob(
      { uid, applicationId, requestId },
      requestId,
      5 * 24 * 60 * 60 * 1000
    ).catch(() => {});
  }

  return { sent: true };
}

export async function sendFollowUpEmail(
  db: Firestore,
  uid: string,
  applicationId: string,
  requestId: string
): Promise<{ sent: boolean }> {
  const appRef = userApplicationRef(db, uid, applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }
  const app = docToApplication(appSnap.id, appSnap.data() as Record<string, unknown>);

  if (app.status !== 'thank_you_sent') {
    throw new HttpError(
      409,
      'Follow-up can only be sent after a thank-you email was sent.',
      'CONFLICT',
      { status: app.status }
    );
  }

  if (toMillis(app.followup_sent)) {
    return { sent: true };
  }

  const listSnap = await listingDocumentRef(db, app.listing_id).get();
  if (!listSnap.exists) {
    throw new HttpError(404, 'Listing not found for application.', 'NOT_FOUND');
  }
  const listing = { id: listSnap.id, ...(listSnap.data() as object) } as ListingDocument;

  const to = pickRecruiterEmail(listing);
  if (!to) {
    throw new HttpError(400, 'No recruiter email on file for this listing.', 'NO_RECIPIENT_EMAIL');
  }

  const userSnap = await userDocumentRef(db, uid).get();
  const inboxId = (userSnap.data() as { agentmail_address?: string } | undefined)?.agentmail_address?.trim();
  if (!inboxId) {
    throw new HttpError(400, 'AgentMail inbox is not provisioned for this user.', 'AGENTMAIL_NOT_READY');
  }

  const draft = await claudeDraftFollowUpEmail(listing, requestId);
  const attachments = await resumePdfAttachments(app);
  const send = await sendAgentMailOutbound({
    inboxId,
    to,
    subject: draft.subject,
    text: draft.text,
    html: draft.html,
    requestId,
    idempotencyKey: `followup:${uid}:${applicationId}`,
    attachments,
  });

  if (!send.ok) {
    throw new HttpError(502, 'Failed to send follow-up email.', 'EMAIL_SEND_FAILED', { reason: send.error });
  }

  await appRef.set(
    {
      status: 'followup_sent',
      followup_sent: FieldValue.serverTimestamp(),
      followup_state: 'sent',
      followup_due_at: FieldValue.delete(),
      followup_cancel_reason: FieldValue.delete(),
      followup_last_attempt_at: FieldValue.serverTimestamp(),
      followup_audit: appendFollowupAudit(app, 'sent', requestId),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await emitUserFeed(
    uid,
    {
      action: 'emailed',
      application_id: applicationId,
      listing_id: listing.id,
      detail: 'Follow-up email sent.',
      code: 'FOLLOWUP_SENT',
    },
    requestId,
    { company: listing.company, role: listing.role }
  );

  void updateSheetRowForApplication(db, uid, applicationId, requestId).catch(() => {});

  return { sent: true };
}
