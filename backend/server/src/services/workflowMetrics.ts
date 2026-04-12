import { config } from '../lib/config.js';
import { getQueue } from '../queues/producers.js';
import { QUEUE_NAMES, type QueueName } from '../queues/names.js';
import { readMetricHash } from './workflowTelemetry.js';

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

  const queueTelemetry: Record<string, Record<string, unknown>> = {};
  for (const k of [
    'scrape',
    'match',
    'apply',
    'apply_from_pasted_url',
    'process_response',
    'interview_followup',
  ]) {
    const h = await readMetricHash('queue', k);
    const completed = Number(h.completed ?? '0');
    const failed = Number(h.failed ?? '0');
    const durationCount = Number(h.duration_count ?? '0');
    const durationTotal = Number(h.duration_total_ms ?? '0');
    queueTelemetry[k] = {
      completed,
      failed,
      success_rate:
        completed + failed > 0 ? Number((completed / (completed + failed)).toFixed(4)) : null,
      avg_duration_ms: durationCount > 0 ? Math.round(durationTotal / durationCount) : null,
      updated_at: h.updated_at ?? null,
    };
  }

  const claude = await readMetricHash('claude', 'messages');
  const claudeCalls = Number(claude.calls ?? '0');
  const claudeTokens = Number(claude.tokens_estimate ?? '0');

  const pw = await readMetricHash('playwright', 'submit');
  const pwSuccess = Number(pw.success ?? '0');
  const pwFailed = Number(pw.failed ?? '0');

  return {
    redis_configured: true,
    queues,
    queue_metrics: queueTelemetry,
    claude_token_usage_estimate:
      claudeCalls > 0
        ? {
            total_estimated_tokens: claudeTokens,
            calls: claudeCalls,
            avg_tokens_per_call: Math.round(claudeTokens / Math.max(1, claudeCalls)),
            updated_at: claude.updated_at ?? null,
          }
        : null,
    playwright_success_rate:
      pwSuccess + pwFailed > 0
        ? {
            success: pwSuccess,
            failed: pwFailed,
            rate: Number((pwSuccess / (pwSuccess + pwFailed)).toFixed(4)),
            avg_duration_ms: pw.duration_count
              ? Math.round(Number(pw.duration_total_ms ?? '0') / Number(pw.duration_count))
              : null,
            updated_at: pw.updated_at ?? null,
          }
        : null,
  };
}
