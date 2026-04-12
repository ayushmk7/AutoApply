/**
 * BullMQ queue names mapped to OpenClaw workflows (`docs/02_TECHNICAL_PRD.md` §2.1,
 * `backend/ORCHESTRATION.md`).
 */
export const QUEUE_NAMES = {
  scrape: 'scrape',
  match: 'match',
  apply: 'apply',
  applyFromPastedUrl: 'apply_from_pasted_url',
  processResponse: 'process_response',
  interviewFollowup: 'interview_followup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
