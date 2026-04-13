import { Worker } from 'bullmq';
import { logger } from '../lib/logger.js';
import { getBullConnection } from './connection.js';
import { QUEUE_NAMES } from './names.js';
import { incrMetricCounter, recordMetricDuration } from '../services/workflowTelemetry.js';
import { processApplyJob } from './applyProcessor.js';
import { processApplyFromPastedUrlJob } from './applyFromUrlProcessor.js';
import { processAgentmailProvisionRetryJob } from './agentmailProvisionRetryProcessor.js';
import { processInterviewFollowupJob } from './interviewFollowupProcessor.js';
import { processMatchJob } from './matchProcessor.js';
import { processProcessResponseJob } from './processResponseProcessor.js';
import { processScrapeJob } from './scrapeProcessor.js';

export const WORKFLOW_QUEUE_LIST = [
  QUEUE_NAMES.scrape,
  QUEUE_NAMES.match,
  QUEUE_NAMES.apply,
  QUEUE_NAMES.applyFromPastedUrl,
  QUEUE_NAMES.processResponse,
  QUEUE_NAMES.interviewFollowup,
  QUEUE_NAMES.agentmailProvisionRetry,
] as const;

/**
 * Phase 5.3 — `scrape` concurrency 1; Phase 6 — `match`; Phases 8–10 — `apply` + `apply_from_pasted_url`.
 */
export function registerWorkflowWorkers(): Worker[] {
  const connection = getBullConnection();

  const scrapeWorker = new Worker(
    QUEUE_NAMES.scrape,
    async (job) => {
      return processScrapeJob(job);
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 600_000,
      stalledInterval: 120_000,
    }
  );

  scrapeWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, requestId: job?.data?.requestId },
      'scrape_job_failed'
    );
    void incrMetricCounter('queue', 'scrape', 'failed', 1);
  });
  scrapeWorker.on('completed', (_job, result) => {
    const ms = typeof result === 'object' && result && 'durationMs' in (result as Record<string, unknown>)
      ? Number((result as { durationMs?: number }).durationMs ?? 0)
      : 0;
    void incrMetricCounter('queue', 'scrape', 'completed', 1);
    void recordMetricDuration('queue', 'scrape', ms);
  });

  const matchWorker = new Worker(
    QUEUE_NAMES.match,
    async (job) => {
      return processMatchJob(job);
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 900_000,
      stalledInterval: 120_000,
    }
  );

  matchWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, requestId: job?.data?.requestId },
      'match_job_failed'
    );
    void incrMetricCounter('queue', 'match', 'failed', 1);
  });
  matchWorker.on('completed', (_job, result) => {
    const ms = typeof result === 'object' && result && 'durationMs' in (result as Record<string, unknown>)
      ? Number((result as { durationMs?: number }).durationMs ?? 0)
      : 0;
    void incrMetricCounter('queue', 'match', 'completed', 1);
    void recordMetricDuration('queue', 'match', ms);
  });

  const applyWorker = new Worker(
    QUEUE_NAMES.apply,
    async (job) => {
      return processApplyJob(job);
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 1_800_000,
      stalledInterval: 120_000,
    }
  );

  applyWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, requestId: job?.data?.requestId },
      'apply_job_failed'
    );
    void incrMetricCounter('queue', 'apply', 'failed', 1);
  });
  applyWorker.on('completed', (_job, result) => {
    const ms = typeof result === 'object' && result && 'durationMs' in (result as Record<string, unknown>)
      ? Number((result as { durationMs?: number }).durationMs ?? 0)
      : 0;
    void incrMetricCounter('queue', 'apply', 'completed', 1);
    void recordMetricDuration('queue', 'apply', ms);
  });

  const applyFromUrlWorker = new Worker(
    QUEUE_NAMES.applyFromPastedUrl,
    async (job) => {
      return processApplyFromPastedUrlJob(job);
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 1_800_000,
      stalledInterval: 120_000,
    }
  );

  applyFromUrlWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, requestId: job?.data?.requestId },
      'apply_from_url_job_failed'
    );
    void incrMetricCounter('queue', 'apply_from_pasted_url', 'failed', 1);
  });
  applyFromUrlWorker.on('completed', (_job, result) => {
    const ms = typeof result === 'object' && result && 'durationMs' in (result as Record<string, unknown>)
      ? Number((result as { durationMs?: number }).durationMs ?? 0)
      : 0;
    void incrMetricCounter('queue', 'apply_from_pasted_url', 'completed', 1);
    void recordMetricDuration('queue', 'apply_from_pasted_url', ms);
  });

  const processResponseWorker = new Worker(
    QUEUE_NAMES.processResponse,
    async (job) => {
      return processProcessResponseJob(job);
    },
    {
      connection,
      concurrency: 5,
      lockDuration: 600_000,
      stalledInterval: 120_000,
    }
  );

  processResponseWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, requestId: job?.data?.requestId },
      'process_response_job_failed'
    );
    void incrMetricCounter('queue', 'process_response', 'failed', 1);
  });
  processResponseWorker.on('completed', (_job, result) => {
    const ms = typeof result === 'object' && result && 'durationMs' in (result as Record<string, unknown>)
      ? Number((result as { durationMs?: number }).durationMs ?? 0)
      : 0;
    void incrMetricCounter('queue', 'process_response', 'completed', 1);
    void recordMetricDuration('queue', 'process_response', ms);
  });

  const interviewFollowupWorker = new Worker(
    QUEUE_NAMES.interviewFollowup,
    async (job) => {
      return processInterviewFollowupJob(job);
    },
    {
      connection,
      concurrency: 5,
      lockDuration: 600_000,
      stalledInterval: 120_000,
    }
  );

  interviewFollowupWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, requestId: job?.data?.requestId },
      'interview_followup_job_failed'
    );
    void incrMetricCounter('queue', 'interview_followup', 'failed', 1);
  });
  interviewFollowupWorker.on('completed', (_job, result) => {
    const ms = typeof result === 'object' && result && 'durationMs' in (result as Record<string, unknown>)
      ? Number((result as { durationMs?: number }).durationMs ?? 0)
      : 0;
    void incrMetricCounter('queue', 'interview_followup', 'completed', 1);
    void recordMetricDuration('queue', 'interview_followup', ms);
  });

  const agentmailProvisionRetryWorker = new Worker(
    QUEUE_NAMES.agentmailProvisionRetry,
    async (job) => {
      return processAgentmailProvisionRetryJob(job);
    },
    {
      connection,
      concurrency: 2,
      lockDuration: 600_000,
      stalledInterval: 120_000,
    }
  );

  agentmailProvisionRetryWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, requestId: job?.data?.requestId },
      'agentmail_provision_retry_job_failed'
    );
    void incrMetricCounter('queue', 'agentmail_provision_retry', 'failed', 1);
  });
  agentmailProvisionRetryWorker.on('completed', (_job, result) => {
    const ms = typeof result === 'object' && result && 'durationMs' in (result as Record<string, unknown>)
      ? Number((result as { durationMs?: number }).durationMs ?? 0)
      : 0;
    void incrMetricCounter('queue', 'agentmail_provision_retry', 'completed', 1);
    void recordMetricDuration('queue', 'agentmail_provision_retry', ms);
  });

  return [
    scrapeWorker,
    matchWorker,
    applyWorker,
    applyFromUrlWorker,
    processResponseWorker,
    interviewFollowupWorker,
    agentmailProvisionRetryWorker,
  ];
}
