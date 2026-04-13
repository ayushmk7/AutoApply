/**
 * Aligns with `docs/02_TECHNICAL_PRD.md` §7.3 (`users/{uid}/applications/{id}`).
 */

export type ApplicationStatus =
  | 'queued'
  | 'applying'
  | 'applied'
  | 'emailed'
  | 'waiting'
  | 'rejected_auto'
  | 'rejected_review'
  | 'interview_scheduled'
  | 'thank_you_sent'
  | 'followup_sent'
  | 'offer'
  | 'accepted'
  | 'declined'
  | 'manual_needed';

export type ApplicationMethod = 'ats' | 'email' | 'both';

export interface ApplicationDocument {
  id: string;
  listing_id: string;
  user_id: string;
  status: ApplicationStatus;
  method: ApplicationMethod;
  fit_score: number;
  ats_score: number;
  ats_keywords_matched: string[];
  ats_keywords_missing: string[];
  /** GCS object path or legacy URL string (Phase 8.7 — prefer object path). */
  resume_url: string;
  cover_letter_url: string;
  custom_answers: Record<string, string>;
  submission_screenshot: string;
  applied_date: unknown;
  response_date: unknown;
  response_type: string;
  response_raw: string;
  interview_date: unknown;
  interviewer_names: string[];
  interview_format: string;
  interview_notes: string;
  thank_you_sent: unknown;
  followup_sent: unknown;
  referral_available: boolean;
  referral_contact: string;
  created_at: unknown;
  updated_at: unknown;
  /** Phase 10 — normalized intake URL for in-flight dedupe. */
  intake_url_normalized?: string;
  /** Structured manual / failure reason for UI (Phase 10.8). */
  manual_reason?: string;
  /** Phase 8 — when analyze_job is uncertain. */
  needs_manual_review?: boolean;
  /** Phase 11.5 — user tracker notes (not post-interview notes). */
  user_notes?: string;
  /** Phase 15 — Google Sheet row index (1-based) when synced. */
  sheets_row?: number;
  calendar_event_id?: string;
  calendar_event_url?: string;
  calendar_sync_error?: string;
  followup_due_at?: unknown;
  followup_job_id?: string;
  followup_state?:
    | 'none'
    | 'scheduled'
    | 'cancelled'
    | 'sent'
    | 'skipped_response_received'
    | 'skipped_state_conflict';
  followup_cancel_reason?: string;
  followup_last_attempt_at?: unknown;
  followup_audit?: Array<{
    at: string;
    action: 'scheduled' | 'cancelled' | 'sent' | 'skipped';
    reason?: string;
    request_id?: string;
  }>;
  sheets_row_id?: string;
  sheets_row_version?: number;
  sheets_conflict_state?: 'clean' | 'conflict';
  sheets_conflict_reason?: string;
  sheets_last_sync_direction?: 'firestore_to_sheet' | 'sheet_to_firestore';
  sheets_last_sync_at?: unknown;
}
