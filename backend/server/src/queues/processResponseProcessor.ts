import type { Job } from 'bullmq';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getFirestore } from '../lib/firebase.js';
import { listingDocumentRef, userApplicationRef } from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';
import { claudeClassifyInboundEmail } from '../services/claudeInbound.js';
import { emitUserFeed } from '../services/feedEmit.js';
import { updateSheetRowForApplication } from '../services/googleSheetsSync.js';
import type { ApplicationDocument } from '../types/application.js';
import type { ListingDocument } from '../types/listing.js';
import type { ProcessResponseJobData } from './jobTypes.js';
import { getInterviewFollowupQueue } from './producers.js';

function parseInterviewDate(iso: string | undefined): Timestamp | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return Timestamp.fromDate(d);
}

/**
 * Phase 14.3 — classify inbound mail, update Firestore, optional Sheets + feed (`process_response` workflow).
 */
export async function executeProcessResponseWorkflow(
  data: ProcessResponseJobData
): Promise<{ durationMs: number }> {
  const started = Date.now();
  const { uid, applicationId, email } = data;
  const requestId = data.requestId ?? 'process_response';
  const db = getFirestore();

  let feedCtx: { company?: string; role?: string } = {};
  let listingId: string | undefined;

  try {
    const classification = await claudeClassifyInboundEmail(email.subject, email.body, requestId);

    const patch: Record<string, unknown> = {
      response_type: classification.category.toUpperCase(),
      response_raw: email.body.slice(0, 8000),
      response_date: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    if (applicationId) {
      const appRef = userApplicationRef(db, uid, applicationId);
      const appSnap = await appRef.get();
      if (appSnap.exists) {
        const app = { id: appSnap.id, ...(appSnap.data() as object) } as ApplicationDocument;
        listingId = app.listing_id;
        const listSnap = await listingDocumentRef(db, app.listing_id).get();
        if (listSnap.exists) {
          const listing = { id: listSnap.id, ...(listSnap.data() as object) } as ListingDocument;
          feedCtx = { company: listing.company ?? '', role: listing.role ?? '' };
        }

        if (classification.category === 'rejection') {
          patch.status =
            classification.rejection_subtype === 'auto_screen' ? 'rejected_auto' : 'rejected_review';
        } else if (classification.category === 'interview') {
          patch.status = 'interview_scheduled';
          const idate = parseInterviewDate(classification.interview_iso);
          if (idate) patch.interview_date = idate;
          if (classification.interviewer_names?.length) {
            patch.interviewer_names = classification.interviewer_names;
          }
          if (classification.interview_format) {
            patch.interview_format = classification.interview_format;
          }
        } else if (classification.category === 'info_request') {
          patch.status = 'waiting';
        } else {
          patch.status = 'waiting';
        }

        if (app.followup_state === 'scheduled') {
          patch.followup_state = 'cancelled';
          patch.followup_cancel_reason = 'recruiter_response_received';
          patch.followup_due_at = FieldValue.delete();
          const prevAudit = Array.isArray(app.followup_audit) ? app.followup_audit.slice(-9) : [];
          prevAudit.push({
            at: new Date().toISOString(),
            action: 'cancelled',
            reason: 'recruiter_response_received',
            request_id: requestId,
          });
          patch.followup_audit = prevAudit;
          await getInterviewFollowupQueue()
            .remove(`interview-followup:${uid}:${applicationId}`)
            .catch(() => {});
        }

        await appRef.set(patch, { merge: true });
        await updateSheetRowForApplication(db, uid, applicationId, requestId).catch((err) => {
          logger.warn({ err, uid, applicationId }, 'process_response_sheet_update_failed');
        });
      }
    }

    await emitUserFeed(
      uid,
      {
        action: 'response_received',
        application_id: applicationId ?? undefined,
        listing_id: listingId,
        detail: classification.summary,
        code: classification.category,
      },
      requestId,
      feedCtx
    );
    return { durationMs: Date.now() - started };
  } catch (err) {
    logger.error({ err, uid, applicationId, requestId }, 'process_response_job_failed');
    await emitUserFeed(
      uid,
      {
        action: 'failed',
        application_id: applicationId ?? undefined,
        listing_id: listingId,
        detail: 'Inbound email classification failed.',
        code: 'CLASSIFY_FAILED',
      },
      requestId,
      feedCtx
    );
    return { durationMs: Date.now() - started };
  }
}

export async function processProcessResponseJob(
  job: Job<ProcessResponseJobData>
): Promise<{ durationMs: number }> {
  return executeProcessResponseWorkflow({
    ...job.data,
    requestId: job.data.requestId ?? String(job.id),
  });
}
