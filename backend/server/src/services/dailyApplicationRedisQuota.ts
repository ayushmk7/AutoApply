import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { getQuotaRedis, utcDateYmd } from '../lib/redisQuota.js';

function msUntilUtcDayEndPlusBuffer(bufferMs: number, d = new Date()): number {
  const nextUtcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(1, nextUtcMidnight - d.getTime() + bufferMs);
}

/**
 * Phase 16 — distributed per-user daily cap when creating new application rows (approve / match / from-url).
 * Firestore remains source of truth; Redis prevents cross-worker races when present.
 */
export async function tryReserveDailyNewApplicationSlot(
  uid: string,
  cap: number,
  requestId: string
): Promise<{ ok: true } | { ok: false }> {
  const r = getQuotaRedis();
  if (!r) {
    return { ok: true };
  }

  const day = utcDateYmd();
  const key = `quota:daily:newapp:${uid}:${day}`;
  const ttlMs = msUntilUtcDayEndPlusBuffer(config.dailyQuotaRedisTtlBufferMs);

  try {
    const n = await r.incr(key);
    if (n === 1) {
      await r.pexpire(key, ttlMs);
    }
    if (n > cap) {
      await r.decr(key);
      logger.info({ requestId, uid, cap }, 'daily_new_application_cap_exceeded');
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    logger.warn({ err, requestId, uid }, 'daily_new_application_redis_error');
    return { ok: true };
  }
}

export async function releaseDailyNewApplicationSlot(uid: string, requestId: string): Promise<void> {
  const r = getQuotaRedis();
  if (!r) return;
  const key = `quota:daily:newapp:${uid}:${utcDateYmd()}`;
  try {
    const v = await r.decr(key);
    if (v < 0) {
      await r.set(key, '0');
    }
  } catch (err) {
    logger.warn({ err, requestId, uid }, 'daily_new_application_redis_release_failed');
  }
}
