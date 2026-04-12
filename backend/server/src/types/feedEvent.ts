/**
 * Live feed — Phase 8–10 internal actions + Phase 13.3 PRD wire (`application_event`).
 * Backend PRD §3.6 lists core `action` values; pipeline adds intake / cover-letter steps.
 */

export type FeedPipelineAction =
  | 'fetching_job_page'
  | 'extracting_listing'
  | 'generating_resume'
  | 'compiling_pdf'
  | 'ats_scoring'
  | 'generating_cover_letter'
  | 'generating_answers'
  | 'filling_form'
  | 'captcha_solving'
  | 'submitting'
  | 'manual_needed'
  | 'submitted'
  | 'failed'
  | 'emailed'
  | 'interview_scheduled'
  | 'response_received'
  | 'ghost_detected'
  | 'referral_found'
  | 'error';

/** Worker → `emitUserFeed` partial (before PRD wire envelope). */
export interface FeedEmitPartial {
  action: FeedPipelineAction;
  application_id?: string;
  listing_id?: string;
  detail?: string;
  code?: string;
  next_step?: string;
}

/**
 * WebSocket + REST feed history shape (`docs/03_BACKEND_PRD.md` §3.6, Phase 13.3).
 * Optional fields beyond PRD example live in `metadata` to keep clients forward-compatible.
 */
export interface ApplicationEventWire {
  type: 'application_event';
  data: {
    application_id?: string;
    company: string;
    role: string;
    action: string;
    detail: string;
    timestamp: string;
    metadata: Record<string, unknown>;
  };
}
