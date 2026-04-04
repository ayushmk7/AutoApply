import { randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { config } from '../lib/config.js';
import { HttpError } from '../lib/httpError.js';
import {
  listingDocumentRef,
  userApplicationRef,
  userApplicationsCollection,
  userDocumentRef,
} from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';
import { applicationIdForUserListing } from './applicationId.js';
import { emptyApplicationShell } from './applicationPayload.js';
import { detectAtsTypeFromUrl } from './atsDetect.js';
import { enqueueApplyFromPastedUrlJob } from '../queues/producers.js';
import { assertUrlSafeForFetch } from './ssrfGuard.js';
import { normalizeJobUrl } from './urlNormalize.js';
import type { ApplicationDocument } from '../types/application.js';
import { countApplicationsStartedUtcDay } from './dailyApplyQuota.js';
import {
  releaseDailyNewApplicationSlot,
  tryReserveDailyNewApplicationSlot,
} from './dailyApplicationRedisQuota.js';
import { effectiveDailyApplicationCap } from './userApplyQuota.js';

export const fromUrlBodySchema = z
  .object({
    url: z.string().trim().min(1).optional(),
    job_description_text: z.string().max(500_000).optional(),
    force_manual_submit: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    const hasUrl = Boolean(val.url?.trim());
    const hasJd = Boolean(val.job_description_text?.trim());
    if (!hasUrl && !hasJd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either url or job_description_text is required.',
        path: ['url'],
      });
    }
  });

export type FromUrlBody = z.infer<typeof fromUrlBodySchema>;

const IN_FLIGHT: ApplicationDocument['status'][] = ['queued', 'applying'];

async function findInFlightIntake(
  db: Firestore,
  uid: string,
  normalized: string | undefined
): Promise<ApplicationDocument | null> {
  if (!normalized) return null;
  const snap = await userApplicationsCollection(db, uid).limit(200).get();
  for (const d of snap.docs) {
    const row = d.data() as ApplicationDocument;
    if (row.intake_url_normalized !== normalized) continue;
    if (!IN_FLIGHT.includes(row.status)) continue;
    return row;
  }
  return null;
}

/**
 * Phase 10.1 — `POST /api/jobs/from-url` handler core.
 */
export async function startApplyFromUrl(
  db: Firestore,
  uid: string,
  body: FromUrlBody,
  requestId: string
): Promise<{
  application_id: string;
  listing_id: string;
  status: string;
  message: string;
  reused?: boolean;
}> {
  const rawUrl = body.url?.trim();
  const jd = body.job_description_text?.trim() ?? '';
  let normalized: string | undefined;
  if (rawUrl) {
    try {
      normalized = (await assertUrlSafeForFetch(rawUrl)).toString();
    } catch (err) {
      if (err instanceof HttpError) {
        throw err;
      }
      throw new HttpError(400, 'Invalid URL.', 'INVALID_URL');
    }
  }

  if (normalized) {
    const existing = await findInFlightIntake(db, uid, normalizeJobUrl(normalized));
    if (existing?.id) {
      return {
        application_id: existing.id,
        listing_id: existing.listing_id,
        status: existing.status,
        message: 'Existing in-flight application for this URL.',
        reused: true,
      };
    }
  }

  const userSnap = await userDocumentRef(db, uid).get();
  const udata = userSnap.data() as { is_demo?: boolean; preferences?: { daily_limit?: number } } | undefined;
  const isDemo = Boolean(udata?.is_demo);
  const cap = effectiveDailyApplicationCap(udata?.preferences?.daily_limit, isDemo);
  const usedToday = await countApplicationsStartedUtcDay(db, uid);
  if (usedToday >= cap) {
    throw new HttpError(429, 'Daily application limit reached.', 'RATE_LIMITED');
  }
  const slot = await tryReserveDailyNewApplicationSlot(uid, cap, requestId);
  if (!slot.ok) {
    throw new HttpError(429, 'Daily application limit reached.', 'RATE_LIMITED');
  }

  const listingId = randomUUID();
  const applicationId = applicationIdForUserListing(uid, listingId);
  const listingUrl = normalized || config.manualPlaceholderJobUrl;
  const shell = emptyApplicationShell(applicationId, listingId, uid, 0, {
    available: false,
    contact: '',
  });

  try {
    await listingDocumentRef(db, listingId).set(
      {
        id: listingId,
        company: 'Pending',
        role: 'Pending',
        location: '',
        url: listingUrl,
        source: normalized ? 'user_url' : 'manual_paste',
        description: jd,
        posted_date: FieldValue.serverTimestamp(),
        first_seen: FieldValue.serverTimestamp(),
        last_seen: FieldValue.serverTimestamp(),
        ghost_score: 0,
        ghost_reasons: [],
        urgency_score: config.defaultListingUrgencyScore,
        urgency_label: config.defaultListingUrgencyLabel,
        ats_type: detectAtsTypeFromUrl(listingUrl),
        requires_cover_letter: false,
        custom_questions: [],
        active: true,
      },
      { merge: true }
    );

    await userApplicationRef(db, uid, applicationId).set(
      {
        ...shell,
        status: 'queued',
        intake_url_normalized: normalized ? normalizeJobUrl(normalized) : undefined,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    await releaseDailyNewApplicationSlot(uid, requestId);
    throw err;
  }

  try {
    await enqueueApplyFromPastedUrlJob(
      {
        uid,
        applicationId,
        listingId,
        url: rawUrl,
        job_description_text: jd || undefined,
        force_manual_submit: body.force_manual_submit,
        requestId,
      },
      requestId
    );
  } catch (err) {
    logger.error({ err, requestId, uid }, 'enqueue_apply_from_url_failed');
  }

  return {
    application_id: applicationId,
    listing_id: listingId,
    status: 'queued',
    message: config.redisUrl
      ? 'Processing started'
      : 'Queued, but REDIS_URL is not configured so the worker will not run this job.',
  };
}

export async function getFromUrlApplicationStatus(
  db: Firestore,
  uid: string,
  applicationId: string
): Promise<Record<string, unknown>> {
  const ref = userApplicationRef(db, uid, applicationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
  }
  const app = snap.data() as ApplicationDocument;
  if (app.user_id && app.user_id !== uid) {
    throw new HttpError(403, 'Forbidden.', 'FORBIDDEN');
  }

  let listing: Record<string, unknown> | null = null;
  if (app.listing_id) {
    const l = await listingDocumentRef(db, app.listing_id).get();
    if (l.exists) {
      listing = { id: app.listing_id, ...(l.data() as object) } as Record<string, unknown>;
    }
  }

  return {
    application: { id: applicationId, ...(app as unknown as Record<string, unknown>) },
    listing,
  };
}
