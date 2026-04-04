import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { getScrapeQueue } from './producers.js';
import { QUEUE_NAMES } from './names.js';

/**
 * Phase 5.6 — repeatable scrape job every `SCRAPE_INTERVAL_MS` (2–4h range; default 3h).
 */
export async function registerScrapeScheduler(): Promise<void> {
  if (!config.redisUrl) {
    logger.info('scrape_scheduler_skipped_no_redis');
    return;
  }

  const queue = getScrapeQueue();
  await queue.upsertJobScheduler(
    'autoapply-scrape-cron',
    { every: config.scrapeIntervalMs },
    {
      name: 'scrape_jobs',
      data: { triggeredBy: 'cron', requestId: 'scheduler' },
      opts: {
        attempts: 2,
        backoff: { type: 'exponential', delay: config.scrapeJobBackoffDelayMs },
      },
    }
  );

  logger.info(
    { intervalMs: config.scrapeIntervalMs, queue: QUEUE_NAMES.scrape },
    'scrape_scheduler_registered'
  );
}
