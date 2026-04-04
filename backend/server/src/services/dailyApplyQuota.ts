import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { userApplicationsCollection } from '../lib/firestorePaths.js';

/**
 * Phase 6.2 — count application rows created today (UTC boundary) for `daily_limit`.
 * If `preferences.timezone` is added later, switch window calculation; PRD defaults to UTC when unset.
 */
export async function countApplicationsStartedUtcDay(db: Firestore, uid: string): Promise<number> {
  const now = new Date();
  const startMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0
  );
  const startTs = Timestamp.fromMillis(startMs);

  const col = userApplicationsCollection(db, uid);
  let snap;
  try {
    snap = await col.where('created_at', '>=', startTs).get();
  } catch {
    snap = await col.get();
  }

  return snap.docs.filter((d) => {
    const c = d.data().created_at as Timestamp | undefined;
    const ms = c?.toMillis?.() ?? 0;
    return ms >= startMs;
  }).length;
}
