import type { Firestore } from 'firebase-admin/firestore';

/**
 * Canonical Firestore paths (Phase 2.2) — `users/{uid}`, `users/{uid}/applications/{appId}`, `listings/{listingId}`.
 */
export const COLLECTION_USERS = 'users';
export const COLLECTION_LISTINGS = 'listings';
export const COLLECTION_STATS = 'stats';
export const COLLECTION_SCRAPE_REPOS = 'scrape_repos';
export const COLLECTION_APPLICATIONS = 'applications';
export const COLLECTION_JOB_MATCHES = 'job_matches';
export const COLLECTION_JOB_SKIPS = 'job_skips';
export const COLLECTION_FEED_EVENTS = 'feed_events';
export const COLLECTION_TOKENS = 'tokens';
export const COLLECTION_AGENTMAIL_DEDUPE = 'agentmail_webhook_dedupe';
export const DOC_STATS_GLOBAL = 'global';

export function userDocumentRef(db: Firestore, uid: string) {
  return db.collection(COLLECTION_USERS).doc(uid);
}

export function userApplicationsCollection(db: Firestore, uid: string) {
  return userDocumentRef(db, uid).collection(COLLECTION_APPLICATIONS);
}

export function userApplicationRef(db: Firestore, uid: string, applicationId: string) {
  return userApplicationsCollection(db, uid).doc(applicationId);
}

export function userFeedEventsCollection(db: Firestore, uid: string) {
  return userDocumentRef(db, uid).collection(COLLECTION_FEED_EVENTS);
}

export function userJobMatchRef(db: Firestore, uid: string, listingId: string) {
  return userDocumentRef(db, uid).collection(COLLECTION_JOB_MATCHES).doc(listingId);
}

export function userJobSkipRef(db: Firestore, uid: string, listingId: string) {
  return userDocumentRef(db, uid).collection(COLLECTION_JOB_SKIPS).doc(listingId);
}

export function listingDocumentRef(db: Firestore, listingId: string) {
  return db.collection(COLLECTION_LISTINGS).doc(listingId);
}

export function globalStatsRef(db: Firestore) {
  return db.collection(COLLECTION_STATS).doc(DOC_STATS_GLOBAL);
}

export function scrapeRepoStateRef(db: Firestore, repoKey: string) {
  return db.collection(COLLECTION_SCRAPE_REPOS).doc(repoKey);
}

/** Phase 15 — encrypted Google OAuth token bundle (`docs/03_BACKEND_PRD.md` §8.1). */
export function userGoogleSheetsTokensRef(db: Firestore, uid: string) {
  return userDocumentRef(db, uid).collection(COLLECTION_TOKENS).doc('google');
}

/** Phase 14 — idempotent inbound webhook deliveries. */
export function agentmailDedupeRef(db: Firestore, dedupeKey: string) {
  return db.collection(COLLECTION_AGENTMAIL_DEDUPE).doc(dedupeKey);
}
