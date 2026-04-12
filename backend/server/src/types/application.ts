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
}
