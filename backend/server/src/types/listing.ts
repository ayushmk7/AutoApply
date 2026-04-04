/**
 * Aligns with `docs/02_TECHNICAL_PRD.md` §7.2 (`listings/{id}`).
 */

export type ListingSource =
  | 'simplify'
  | 'pittcsc'
  | 'reavnail'
  | 'apollo'
  | 'manual'
  | 'user_url'
  | 'manual_paste';

export type AtsTypeHint =
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'icims'
  | 'smartrecruiters'
  | 'unknown';

export interface ListingRecruiterContact {
  name?: string;
  email?: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
}

export interface ListingDocument {
  id: string;
  company: string;
  role: string;
  location: string;
  url: string;
  source: ListingSource;
  description: string;
  posted_date: unknown;
  first_seen: unknown;
  last_seen: unknown;
  ghost_score: number;
  ghost_reasons: string[];
  urgency_score: number;
  urgency_label: string;
  ats_type: AtsTypeHint;
  requires_cover_letter: boolean;
  custom_questions: unknown[];
  active: boolean;
  /** Dedupe key hash input for ops (Phase 5.1). */
  dedupe_key?: string;
  parse_confidence?: number;
  apollo_contacts?: ListingRecruiterContact[];
  /** Last HTTP link health check status (Phase 5.4). */
  link_health_status?: number | null;
}
