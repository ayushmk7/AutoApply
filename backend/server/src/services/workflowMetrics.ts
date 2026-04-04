import { config } from '../lib/config.js';
import { getQueue } from '../queues/producers.js';
import { QUEUE_NAMES, type QueueName } from '../queues/names.js';

/**
 * Phase 17 — BullMQ depth snapshot (no PII). Claude / Playwright rates are placeholders until instrumented.
 */
export async function getWorkflowMetricsSnapshot(): Promise<Record<string, unknown>> {
  if (!config.redisUrl) {
    return {
      redis_configured: false,
      claude_token_usage_estimate: null,
      playwright_success_rate: null,
    };
  }

  const queues: Record<string, Record<string, number>> = {};
  for (const key of Object.keys(QUEUE_NAMES) as (keyof typeof QUEUE_NAMES)[]) {
    const name = QUEUE_NAMES[key] as QueueName;
    const q = getQueue(name);
    queues[key] = await q.getJobCounts();
  }

  return {
    redis_configured: true,
    queues,
    claude_token_usage_estimate: null,
    playwright_success_rate: null,
  };
}
