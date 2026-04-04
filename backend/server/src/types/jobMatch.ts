/**
 * Phase 6 — per-user match row for a listing (`users/{uid}/job_matches/{listingId}`).
 * Used by `GET /api/jobs` for `min_fit_score` / `has_referral` before an application exists.
 */

export interface JobMatchDocument {
  listing_id: string;
  fit_score: number;
  referral_available: boolean;
  referral_contact: string;
  /** Short Claude rationale (not shown in PRD; useful for debugging / future UI). */
  reasoning?: string;
  matched_at: unknown;
}
