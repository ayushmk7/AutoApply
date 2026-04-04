import { Worker } from 'bullmq';
import { logger } from '../lib/logger.js';
import { getBullConnection } from './connection.js';
import { QUEUE_NAMES } from './names.js';
import { processApplyJob } from './applyProcessor.js';
import { processApplyFromPastedUrlJob } from './applyFromUrlProcessor.js';
import { processMatchJob } from './matchProcessor.js';
import { processProcessResponseJob } from './processResponseProcessor.js';
import { processScrapeJob } from './scrapeProcessor.js';

export const WORKFLOW_QUEUE_LIST = [
  QUEUE_NAMES.scrape,
  QUEUE_NAMES.match,
  QUEUE_NAMES.apply,
  QUEUE_NAMES.applyFromPastedUrl,
  QUEUE_NAMES.processResponse,
] as const;

/**
 * Phase 5.3 — `scrape` concurrency 1; Phase 6 — `match`; Phases 8–10 — `apply` + `apply_from_pasted_url`.
 */
export function registerWorkflowWorkers(): Worker[] {
  const connection = getBullConnection();

  const scrapeWorker = new Worker(
    QUEUE_NAMES.scrape,
    async (job) => {
      await processScrapeJob(job);
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
  });

  const matchWorker = new Worker(
    QUEUE_NAMES.match,
    async (job) => {
      await processMatchJob(job);
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
  });

  const applyWorker = new Worker(
    QUEUE_NAMES.apply,
    async (job) => {
      await processApplyJob(job);
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
  });

  const applyFromUrlWorker = new Worker(
    QUEUE_NAMES.applyFromPastedUrl,
    async (job) => {
      await processApplyFromPastedUrlJob(job);
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
  });

  const processResponseWorker = new Worker(
    QUEUE_NAMES.processResponse,
    async (job) => {
      await processProcessResponseJob(job);
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
  });

  return [scrapeWorker, matchWorker, applyWorker, applyFromUrlWorker, processResponseWorker];
}
