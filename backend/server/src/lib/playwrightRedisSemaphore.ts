import { config } from './config.js';
import { getQuotaRedis } from './redisQuota.js';
import { logger } from './logger.js';

const SLOT_KEY = 'semaphore:playwright:active_slots';

/**
 * Phase 16 — cluster-wide Playwright concurrency (`docs/03_BACKEND_PRD.md` §4.3).
 */
export async function acquirePlaywrightSlotGlobal(
  maxSlots: number,
  requestId: string
): Promise<{ release: () => Promise<void> } | null> {
  const r = getQuotaRedis();
  if (!r) {
    return { release: async () => {} };
  }

  const start = Date.now();
  while (Date.now() - start < config.playwrightSlotWaitMaxMs) {
    try {
      const n = await r.incr(SLOT_KEY);
      if (n <= maxSlots) {
        return {
          release: async () => {
            try {
              const v = await r.decr(SLOT_KEY);
              if (v < 0) {
                await r.set(SLOT_KEY, '0');
              }
            } catch (err) {
              logger.warn({ err, requestId }, 'playwright_slot_release_failed');
            }
          },
        };
      }
      await r.decr(SLOT_KEY);
    } catch (err) {
      logger.warn({ err, requestId }, 'playwright_slot_redis_error');
      return { release: async () => {} };
    }
    await new Promise((res) => setTimeout(res, config.playwrightSlotWaitMsStep));
  }

  logger.warn({ requestId, maxSlots }, 'playwright_slot_acquire_timeout');
  return null;
}
