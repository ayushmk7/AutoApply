import type { Job } from 'bullmq';
import { getFirestore } from '../lib/firebase.js';
import { userApplicationRef } from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';
import { sendFollowUpEmail } from '../services/interviewApi.js';
import type { InterviewFollowupJobData } from './jobTypes.js';

export async function processInterviewFollowupJob(
  job: Job<InterviewFollowupJobData>
): Promise<{ durationMs: number }> {
  const started = Date.now();
  const uid = job.data.uid;
  const applicationId = job.data.applicationId;
  const requestId = job.data.requestId ?? String(job.id);
  const db = getFirestore();

  try {
    const snap = await userApplicationRef(db, uid, applicationId).get();
    if (!snap.exists) return { durationMs: Date.now() - started };
    const status = (snap.data() as { status?: string } | undefined)?.status ?? '';
    if (status !== 'thank_you_sent') {
      return { durationMs: Date.now() - started };
    }
    await sendFollowUpEmail(db, uid, applicationId, requestId);
    return { durationMs: Date.now() - started };
  } catch (err) {
    logger.error({ err, uid, applicationId, requestId }, 'interview_followup_job_failed');
    throw err;
  }
}

