/**
 * Base job payload — extend per queue. `requestId` propagates from HTTP (`docs/06` Phase 1.3).
 */
export interface BaseJobData {
  requestId?: string;
}

export interface ScrapeJobData extends BaseJobData {
  triggeredBy: 'cron' | 'manual';
}

export interface MatchJobData extends BaseJobData {
  listingIds: string[];
  triggeredBy: 'scrape' | 'manual';
}

export interface ApplyJobData extends BaseJobData {
  uid: string;
  applicationId: string;
  listingId: string;
  /** Phase 9 / 10 — skip Playwright submit. */
  force_manual_submit?: boolean;
}

/** Phase 10 — `apply_from_pasted_url` workflow before reusing apply pipeline. */
export interface ApplyFromPastedUrlJobData extends BaseJobData {
  uid: string;
  applicationId: string;
  listingId: string;
  url?: string;
  job_description_text?: string;
  force_manual_submit?: boolean;
}

/** Phase 14.3 — `process_response` / classify queue (`docs/02_TECHNICAL_PRD.md`). */
export interface ProcessResponseJobData extends BaseJobData {
  uid: string;
  applicationId: string | null;
  email: {
    dedupeKey: string;
    from: string;
    to: string;
    subject: string;
    body: string;
  };
}

export interface InterviewFollowupJobData extends BaseJobData {
  uid: string;
  applicationId: string;
}

export interface AgentmailProvisionRetryJobData extends BaseJobData {
  uid: string;
  attempt: number;
  reason: string;
}
