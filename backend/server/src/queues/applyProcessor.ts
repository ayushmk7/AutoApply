import type { Job } from 'bullmq';
import { getFirestore } from '../lib/firebase.js';
import { runApplyPipeline } from '../services/applyPipeline.js';
import type { ApplyJobData } from './jobTypes.js';

export async function processApplyJob(job: Job<ApplyJobData>): Promise<void> {
  const { uid, applicationId, listingId, force_manual_submit } = job.data;
  const db = getFirestore();
  await runApplyPipeline({
    db,
    uid,
    applicationId,
    listingId,
    requestId: job.data.requestId ?? String(job.id),
    forceManualSubmit: force_manual_submit,
  });
}
