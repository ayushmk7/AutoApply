import { FieldValue } from 'firebase-admin/firestore';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { config } from '../lib/config.js';
import {
  COLLECTION_USERS,
  listingDocumentRef,
  userApplicationRef,
  userJobMatchRef,
  userJobSkipRef,
} from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';
import { getFirestore } from '../lib/firebase.js';
import type { MatchJobData } from './jobTypes.js';
import { emptyApplicationShell } from '../services/applicationPayload.js';
import { applicationIdForUserListing } from '../services/applicationId.js';
import { claudeFitScore } from '../services/claude.js';
import { countApplicationsStartedUtcDay } from '../services/dailyApplyQuota.js';
import {
  releaseDailyNewApplicationSlot,
  tryReserveDailyNewApplicationSlot,
} from '../services/dailyApplicationRedisQuota.js';
import { findReferralForCompany } from '../services/referralMatch.js';
import { buildProfileSummaryForMatch, userHasMatchableProfile } from '../services/profileSummary.js';
import type { ListingDocument } from '../types/listing.js';
import type { ProfileDocument } from '../types/profile.js';
import { getQuotaRedis } from '../lib/redisQuota.js';
import { effectiveDailyApplicationCap } from '../services/userApplyQuota.js';
import { enqueueApplyJob } from './producers.js';

const TERMINAL_APPLICATION_STATUSES = new Set([
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
]);

function listingSummary(listing: ListingDocument): string {
  return [
    `Company: ${listing.company}`,
    `Role: ${listing.role}`,
    `Location: ${listing.location}`,
    `URL: ${listing.url}`,
    `Ghost score: ${listing.ghost_score}`,
    `Description:\n${listing.description.slice(0, 8000)}`,
  ].join('\n');
}

/**
 * Phase 6.1 — score listings per user, referral match; Phase 6.2 — threshold, daily_limit (UTC), referral-first pause before auto-apply.
 */
export async function processMatchJob(job: Job<MatchJobData>): Promise<void> {
  const requestId = job.data?.requestId ?? job.id ?? 'match';
  const listingIds = job.data?.listingIds;
  const triggeredBy = job.data?.triggeredBy;

  if (triggeredBy !== 'scrape' && triggeredBy !== 'manual') {
    throw new UnrecoverableError('invalid_match_payload');
  }
  if (!Array.isArray(listingIds) || listingIds.length === 0) {
    throw new UnrecoverableError('invalid_match_listing_ids');
  }

  if (!config.anthropicApiKey) {
    throw new Error('match_requires_ANTHROPIC_API_KEY');
  }

  const db = getFirestore();
  const usersSnap = await db.collection(COLLECTION_USERS).get();

  for (const listingId of listingIds) {
    const listSnap = await listingDocumentRef(db, listingId).get();
    if (!listSnap.exists) {
      logger.warn({ requestId, listingId }, 'match_listing_missing');
      continue;
    }

    const listing = { id: listingId, ...(listSnap.data() as object) } as ListingDocument;
    const lsum = listingSummary(listing);

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const user = { uid, ...(userDoc.data() as object) } as ProfileDocument;

      if (!userHasMatchableProfile(user)) {
        continue;
      }

      const skipSnap = await userJobSkipRef(db, uid, listingId).get();
      if (skipSnap.exists && (skipSnap.data() as { skipped?: boolean })?.skipped === true) {
        continue;
      }

      const profileSummary = buildProfileSummaryForMatch(user);
      const fit = await claudeFitScore(profileSummary, lsum, requestId);
      const referral = findReferralForCompany(user.preferences?.linkedin_connections, listing.company);

      await userJobMatchRef(db, uid, listingId).set(
        {
          listing_id: listingId,
          fit_score: fit.fit_score,
          referral_available: referral.available,
          referral_contact: referral.contact,
          reasoning: fit.reasoning,
          matched_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const appId = applicationIdForUserListing(uid, listingId);
      const appRef = userApplicationRef(db, uid, appId);
      const appSnap = await appRef.get();
      const existing = appSnap.exists ? (appSnap.data() as { status?: string }) : undefined;

      if (existing?.status && TERMINAL_APPLICATION_STATUSES.has(existing.status)) {
        continue;
      }

      const threshold =
        user.preferences?.auto_apply_threshold ?? config.defaultAutoApplyThreshold;
      const isDemoUser = Boolean((user as ProfileDocument & { is_demo?: boolean }).is_demo);
      const dailyCap = effectiveDailyApplicationCap(user.preferences?.daily_limit, isDemoUser);
      const usedToday = await countApplicationsStartedUtcDay(db, uid);
      const quotaOk = usedToday < dailyCap;

      /** Phase 6.2 — pause auto-apply when a referral path exists so the user can approve first. */
      const referralPause = referral.available;
      const shouldAutoQueue =
        fit.fit_score >= threshold && quotaOk && !referralPause && listing.active === true;

      if (!shouldAutoQueue) {
        continue;
      }

      if (existing?.status === 'applying') {
        continue;
      }

      if (!appSnap.exists && getQuotaRedis()) {
        const slot = await tryReserveDailyNewApplicationSlot(uid, dailyCap, requestId);
        if (!slot.ok) {
          continue;
        }
      }

      const shell = emptyApplicationShell(appId, listingId, uid, fit.fit_score, referral);
      try {
        await appRef.set(
          {
            ...shell,
            created_at: existing ? appSnap.data()?.created_at : FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        if (!appSnap.exists && getQuotaRedis()) {
          await releaseDailyNewApplicationSlot(uid, requestId);
        }
        throw err;
      }

      try {
        await enqueueApplyJob(
          { uid, applicationId: appId, listingId, requestId },
          requestId
        );
      } catch (err) {
        logger.error({ err, requestId, uid, listingId }, 'enqueue_apply_failed');
      }
    }
  }

  logger.info(
    { requestId, listingCount: listingIds.length, users: usersSnap.size, triggeredBy },
    'match_job_ok'
  );
}
