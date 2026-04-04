import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { config } from '../lib/config.js';
import { HttpError } from '../lib/httpError.js';
import {
  globalStatsRef,
  listingDocumentRef,
  userApplicationRef,
  userDocumentRef,
  userJobMatchRef,
  userJobSkipRef,
} from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';
import { applicationIdForUserListing } from './applicationId.js';
import { emptyApplicationShell } from './applicationPayload.js';
import { jsonSafeFirestore, jsonSafeValue } from './firestoreJson.js';
import type { ApplicationDocument } from '../types/application.js';
import type { JobMatchDocument } from '../types/jobMatch.js';
import type { ListingDocument } from '../types/listing.js';
import { enqueueApplyJob } from '../queues/producers.js';
import { countApplicationsStartedUtcDay } from './dailyApplyQuota.js';
import {
  releaseDailyNewApplicationSlot,
  tryReserveDailyNewApplicationSlot,
} from './dailyApplicationRedisQuota.js';
import { getQuotaRedis } from '../lib/redisQuota.js';
import { effectiveDailyApplicationCap } from './userApplyQuota.js';

export const jobsListQuerySchema = z.object({
  source: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  min_fit_score: z.coerce.number().min(0).max(100).optional(),
  max_ghost_score: z.coerce.number().min(0).max(100).optional(),
  status: z.string().optional(),
  has_referral: z.enum(['true', 'false']).optional(),
  sort_by: z.enum(['posted_date', 'fit_score', 'ghost_score', 'urgency']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type JobsListQuery = z.infer<typeof jobsListQuerySchema>;

export interface JobBoardRow {
  listing: Record<string, unknown>;
  fit_score: number | null;
  referral_available: boolean | null;
  referral_contact: string | null;
  application: Record<string, unknown> | null;
  skipped: boolean;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function firstSeenMs(data: Record<string, unknown>): number {
  const fs = data.first_seen;
  if (fs && typeof fs === 'object' && 'toMillis' in fs && typeof (fs as { toMillis: () => number }).toMillis === 'function') {
    return (fs as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/**
 * Phase 7.1 — in-memory filter/sort/pagination (doc: OK for demo scale; add indexes for production).
 */
export async function listJobsForUser(
  db: Firestore,
  uid: string,
  query: JobsListQuery
): Promise<{ jobs: JobBoardRow[]; total: number; page: number }> {
  const listingsSnap = await db.collection('listings').limit(config.listingsQueryMaxDocs).get();

  const [matchesSnap, appsSnap, skipsSnap] = await Promise.all([
    userDocumentRef(db, uid).collection('job_matches').get(),
    userDocumentRef(db, uid).collection('applications').get(),
    userDocumentRef(db, uid).collection('job_skips').get(),
  ]);

  const matchByListing = new Map<string, JobMatchDocument>();
  for (const d of matchesSnap.docs) {
    matchByListing.set(d.id, d.data() as JobMatchDocument);
  }

  const appByListing = new Map<string, ApplicationDocument>();
  for (const d of appsSnap.docs) {
    const a = d.data() as ApplicationDocument;
    if (a.listing_id) appByListing.set(a.listing_id, a);
  }

  const skipped = new Set<string>();
  for (const d of skipsSnap.docs) {
    const s = d.data() as { skipped?: boolean };
    if (s?.skipped) skipped.add(d.id);
  }

  const listingById = new Map<string, ListingDocument>();
  for (const doc of listingsSnap.docs) {
    listingById.set(doc.id, doc.data() as ListingDocument);
  }

  const missingListingIds = [
    ...new Set(
      appsSnap.docs
        .map((d) => (d.data() as ApplicationDocument).listing_id)
        .filter((lid): lid is string => Boolean(lid) && !listingById.has(lid))
    ),
  ];
  await Promise.all(
    missingListingIds.map(async (lid) => {
      const extra = await listingDocumentRef(db, lid).get();
      if (extra.exists) {
        listingById.set(lid, extra.data() as ListingDocument);
      }
    })
  );

  const rows: JobBoardRow[] = [];

  for (const [listingId, data] of listingById.entries()) {
    const hasApplication = appByListing.has(listingId);
    if (data.active === false && !hasApplication) continue;

    if (query.source && data.source !== query.source) continue;

    const companyQ = norm(query.company);
    if (companyQ && !norm(data.company).includes(companyQ)) continue;

    const locQ = norm(query.location);
    if (locQ && !norm(data.location).includes(locQ)) continue;

    if (query.max_ghost_score !== undefined && data.ghost_score > query.max_ghost_score) continue;

    const match = matchByListing.get(listingId);
    const fit = match?.fit_score;

    if (query.min_fit_score !== undefined) {
      if (fit === undefined || fit < query.min_fit_score) continue;
    }

    if (query.has_referral === 'true' && !match?.referral_available) continue;
    if (query.has_referral === 'false' && match?.referral_available) continue;

    const app = appByListing.get(listingId) ?? null;

    if (query.status) {
      if (!app || app.status !== query.status) continue;
    }

    if (skipped.has(listingId)) continue;

    rows.push({
      listing: jsonSafeFirestore({
        id: listingId,
        ...(data as unknown as Record<string, unknown>),
      }),
      fit_score: fit ?? null,
      referral_available: match?.referral_available ?? null,
      referral_contact: match?.referral_contact ?? null,
      application: app ? jsonSafeFirestore(app as unknown as Record<string, unknown>) : null,
      skipped: false,
    });
  }

  const sortBy = query.sort_by ?? 'posted_date';
  rows.sort((a, b) => {
    if (sortBy === 'ghost_score') {
      return (
        ((a.listing.ghost_score as number) ?? 0) - ((b.listing.ghost_score as number) ?? 0)
      );
    }
    if (sortBy === 'urgency') {
      return (
        ((b.listing.urgency_score as number) ?? 0) - ((a.listing.urgency_score as number) ?? 0)
      );
    }
    if (sortBy === 'fit_score') {
      const fa = a.fit_score ?? -1;
      const fb = b.fit_score ?? -1;
      return fb - fa;
    }
    const tb = firstSeenMs(b.listing as Record<string, unknown>);
    const ta = firstSeenMs(a.listing as Record<string, unknown>);
    return tb - ta;
  });

  const total = rows.length;
  const page = query.page;
  const limit = query.limit;
  const start = (page - 1) * limit;
  const slice = rows.slice(start, start + limit);

  return { jobs: slice, total, page };
}

export async function getJobDetailForUser(
  db: Firestore,
  uid: string,
  listingId: string
): Promise<JobBoardRow & { listing: Record<string, unknown> }> {
  const listSnap = await listingDocumentRef(db, listingId).get();
  if (!listSnap.exists) {
    throw new HttpError(404, 'Listing not found.', 'NOT_FOUND');
  }

  const data = { id: listingId, ...(listSnap.data() as object) } as ListingDocument;
  const [matchSnap, appSnap, skipSnap] = await Promise.all([
    userJobMatchRef(db, uid, listingId).get(),
    userApplicationRef(db, uid, applicationIdForUserListing(uid, listingId)).get(),
    userJobSkipRef(db, uid, listingId).get(),
  ]);

  const match = matchSnap.exists ? (matchSnap.data() as JobMatchDocument) : undefined;
  const app = appSnap.exists ? (appSnap.data() as ApplicationDocument) : null;
  const skip = skipSnap.exists && (skipSnap.data() as { skipped?: boolean })?.skipped === true;

  return {
    listing: jsonSafeFirestore(data as unknown as Record<string, unknown>),
    fit_score: match?.fit_score ?? null,
    referral_available: match?.referral_available ?? null,
    referral_contact: match?.referral_contact ?? null,
    application: app ? jsonSafeFirestore(app as unknown as Record<string, unknown>) : null,
    skipped: Boolean(skip),
  };
}

export async function approveJobForUser(
  db: Firestore,
  uid: string,
  listingId: string,
  requestId: string
): Promise<{ application_id: string; status: string; already_approved?: boolean }> {
  const listSnap = await listingDocumentRef(db, listingId).get();
  if (!listSnap.exists) {
    throw new HttpError(404, 'Listing not found.', 'NOT_FOUND');
  }

  const listing = listSnap.data() as ListingDocument;
  if (!listing.url?.trim()) {
    throw new HttpError(400, 'Listing has no application URL.', 'VALIDATION_ERROR');
  }

  const appId = applicationIdForUserListing(uid, listingId);
  const appRef = userApplicationRef(db, uid, appId);
  const appSnap = await appRef.get();
  const existing = appSnap.exists ? (appSnap.data() as ApplicationDocument) : undefined;

  if (
    existing?.status === 'queued' ||
    existing?.status === 'applying' ||
    existing?.status === 'applied'
  ) {
    return { application_id: appId, status: existing.status, already_approved: true };
  }

  const userSnap = await userDocumentRef(db, uid).get();
  const udata = userSnap.data() as
    | { is_demo?: boolean; preferences?: { daily_limit?: number } }
    | undefined;
  const isDemo = Boolean(udata?.is_demo);
  const dailyCap = effectiveDailyApplicationCap(udata?.preferences?.daily_limit, isDemo);

  let reservedRedis = false;
  if (!appSnap.exists) {
    const usedToday = await countApplicationsStartedUtcDay(db, uid);
    if (usedToday >= dailyCap) {
      throw new HttpError(429, 'Daily application limit reached.', 'RATE_LIMITED');
    }
    if (getQuotaRedis()) {
      const slot = await tryReserveDailyNewApplicationSlot(uid, dailyCap, requestId);
      if (!slot.ok) {
        throw new HttpError(429, 'Daily application limit reached.', 'RATE_LIMITED');
      }
      reservedRedis = true;
    }
  }

  const matchSnap = await userJobMatchRef(db, uid, listingId).get();
  const match = matchSnap.exists ? (matchSnap.data() as JobMatchDocument) : undefined;
  const fit = match?.fit_score ?? existing?.fit_score ?? 0;
  const referral = {
    available: match?.referral_available ?? existing?.referral_available ?? false,
    contact: match?.referral_contact ?? existing?.referral_contact ?? '',
  };

  await userJobSkipRef(db, uid, listingId).delete().catch(() => undefined);

  const shell = emptyApplicationShell(appId, listingId, uid, fit, referral);
  try {
    await appRef.set(
      {
        ...shell,
        status: 'queued',
        created_at: existing ? appSnap.data()?.created_at : FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    try {
      await enqueueApplyJob({ uid, applicationId: appId, listingId, requestId }, requestId);
    } catch (err) {
      logger.error({ err, requestId, uid, listingId }, 'approve_enqueue_apply_failed');
    }
  } catch (err) {
    if (reservedRedis) {
      await releaseDailyNewApplicationSlot(uid, requestId);
    }
    throw err;
  }

  return { application_id: appId, status: 'queued' };
}

export async function skipJobForUser(db: Firestore, uid: string, listingId: string): Promise<void> {
  const listSnap = await listingDocumentRef(db, listingId).get();
  if (!listSnap.exists) {
    throw new HttpError(404, 'Listing not found.', 'NOT_FOUND');
  }

  await userJobSkipRef(db, uid, listingId).set(
    {
      skipped: true,
      listing_id: listingId,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const appId = applicationIdForUserListing(uid, listingId);
  const appRef = userApplicationRef(db, uid, appId);
  const appSnap = await appRef.get();
  if (appSnap.exists) {
    const st = (appSnap.data() as ApplicationDocument).status;
    if (st === 'queued') {
      await appRef.delete();
    }
  }
}

export async function getJobsStats(db: Firestore): Promise<Record<string, unknown>> {
  const snap = await globalStatsRef(db).get();
  const g = snap.exists ? (snap.data() as Record<string, unknown>) : {};

  return {
    last_scrape_at: jsonSafeValue(g.last_scrape_at),
    last_scrape_status: g.last_scrape_status ?? null,
    last_scrape_error: g.last_scrape_error ?? null,
    last_scrape_new_listings: g.last_scrape_new_listings ?? null,
    last_scrape_repos_checked: g.last_scrape_repos_checked ?? null,
    last_scrape_trigger: g.last_scrape_trigger ?? null,
    listings_active_count: g.listings_active_count ?? null,
    listings_high_ghost_70plus: g.listings_high_ghost_70plus ?? null,
    listings_stats_updated_at: jsonSafeValue(g.listings_stats_updated_at),
  };
}
