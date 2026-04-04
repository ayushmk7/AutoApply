import { createHash } from 'crypto';

/** Deterministic id: same uid + listing always maps to one application doc (Phase 7.3 idempotency). */
export function applicationIdForUserListing(uid: string, listingId: string): string {
  return createHash('sha256')
    .update(`${uid}|${listingId}`, 'utf8')
    .digest('hex')
    .slice(0, 40);
}
