import { Queue } from 'bullmq';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { getBullConnection } from './connection.js';
import type {
  ApplyFromPastedUrlJobData,
  ApplyJobData,
  BaseJobData,
  MatchJobData,
  ProcessResponseJobData,
} from './jobTypes.js';
import { QUEUE_NAMES, type QueueName } from './names.js';

const queueCache = new Map<QueueName, Queue>();

export function withRequestTrace<T extends BaseJobData>(data: T, requestId: string): T {
  return { ...data, requestId };
}

export function getQueue(name: QueueName): Queue {
  let q = queueCache.get(name);
  if (!q) {
    q = new Queue(name, { connection: getBullConnection() });
    queueCache.set(name, q);
  }
  return q;
}

export function getScrapeQueue(): Queue {
  return getQueue(QUEUE_NAMES.scrape);
}

export function getMatchQueue(): Queue {
  return getQueue(QUEUE_NAMES.match);
}

export function getApplyQueue(): Queue {
  return getQueue(QUEUE_NAMES.apply);
}

export function getApplyFromPastedUrlQueue(): Queue {
  return getQueue(QUEUE_NAMES.applyFromPastedUrl);
}

export function getProcessResponseQueue(): Queue {
  return getQueue(QUEUE_NAMES.processResponse);
}

/** Phase 6 — enqueue after new listings are persisted (e.g. scrape). No-op without Redis. */
export async function enqueueMatchForNewListings(
  listingIds: string[],
  triggeredBy: MatchJobData['triggeredBy'],
  requestId: string
): Promise<void> {
  if (listingIds.length === 0) return;
  if (!config.redisUrl) {
    logger.warn({ requestId, count: listingIds.length }, 'match_enqueue_skipped_no_redis');
    return;
  }
  const q = getMatchQueue();
  await q.add(
    'match',
    { listingIds, triggeredBy, requestId } satisfies MatchJobData,
    {
      removeOnComplete: config.bullmqRemoveOnComplete,
      removeOnFail: config.bullmqRemoveOnFail,
    }
  );
}

export async function enqueueApplyJob(data: ApplyJobData, requestId: string): Promise<void> {
  if (!config.redisUrl) {
    logger.warn({ requestId, uid: data.uid }, 'apply_enqueue_skipped_no_redis');
    return;
  }
  const q = getApplyQueue();
  await q.add('apply', withRequestTrace(data, requestId), {
    removeOnComplete: config.bullmqRemoveOnComplete,
    removeOnFail: config.bullmqRemoveOnFail,
  });
}

/** Phase 10 — user URL / pasted JD intake before shared apply pipeline. */
export async function enqueueApplyFromPastedUrlJob(
  data: ApplyFromPastedUrlJobData,
  requestId: string
): Promise<void> {
  if (!config.redisUrl) {
    logger.warn({ requestId, uid: data.uid }, 'apply_from_url_enqueue_skipped_no_redis');
    return;
  }
  const q = getApplyFromPastedUrlQueue();
  await q.add('apply_from_pasted_url', withRequestTrace(data, requestId), {
    removeOnComplete: config.bullmqRemoveOnComplete,
    removeOnFail: config.bullmqRemoveOnFail,
  });
}

/** Phase 14.3 — inbound AgentMail → classify workflow. */
export async function enqueueProcessResponseJob(
  data: ProcessResponseJobData,
  requestId: string
): Promise<void> {
  if (!config.redisUrl) {
    logger.warn({ requestId, uid: data.uid }, 'process_response_enqueue_skipped_no_redis');
    return;
  }
  const q = getProcessResponseQueue();
  await q.add('process_response', withRequestTrace(data, requestId), {
    removeOnComplete: config.bullmqRemoveOnComplete,
    removeOnFail: config.bullmqRemoveOnFail,
  });
}
