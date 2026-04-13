import type { Job } from 'bullmq';
import { getFirestore } from '../lib/firebase.js';
import { logger } from '../lib/logger.js';
import { provisionAgentMailIfNeeded } from '../services/agentmailProvision.js';
import type { AgentmailProvisionRetryJobData } from './jobTypes.js';

export async function processAgentmailProvisionRetryJob(
  job: Job<AgentmailProvisionRetryJobData>
): Promise<{ durationMs: number }> {
  const started = Date.now();
  const requestId = job.data.requestId ?? String(job.id);
  try {
    await provisionAgentMailIfNeeded(getFirestore(), job.data.uid, requestId);
    return { durationMs: Date.now() - started };
  } catch (err) {
    logger.error(
      { err, uid: job.data.uid, requestId, attempt: job.data.attempt, reason: job.data.reason },
      'agentmail_provision_retry_job_failed'
    );
    throw err;
  }
}
