import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { COLLECTION_LISTINGS, globalStatsRef } from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';

/**
 * Phase 7.4 — refresh cheap aggregates into `stats/global` after scrape (doc: precompute in scrape job).
 */
export async function refreshListingStatsAggregate(db: Firestore, requestId: string): Promise<void> {
  try {
    const base = db.collection(COLLECTION_LISTINGS).where('active', '==', true);
    const activeCount = (await base.count().get()).data().count;

    let highGhost = 0;
    try {
      const ghostQ = db
        .collection(COLLECTION_LISTINGS)
        .where('active', '==', true)
        .where('ghost_score', '>=', 70);
      highGhost = (await ghostQ.count().get()).data().count;
    } catch {
      const snap = await base.limit(500).get();
      highGhost = snap.docs.filter((d) => (d.data().ghost_score as number | undefined) ?? 0 >= 70).length;
    }

    await globalStatsRef(db).set(
      {
        listings_active_count: activeCount,
        listings_high_ghost_70plus: highGhost,
        listings_stats_updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    logger.warn({ err, requestId }, 'listing_stats_aggregate_failed');
  }
}
