import type { ApplicationDocument } from '../types/application.js';

/**
 * Firestore-safe defaults for a new application (Technical PRD §7.3).
 */
export function emptyApplicationShell(
  id: string,
  listingId: string,
  uid: string,
  fitScore: number,
  referral: { available: boolean; contact: string }
): Omit<ApplicationDocument, 'created_at' | 'updated_at'> {
  return {
    id,
    listing_id: listingId,
    user_id: uid,
    status: 'queued',
    method: 'ats',
    fit_score: fitScore,
    ats_score: 0,
    ats_keywords_matched: [],
    ats_keywords_missing: [],
    resume_url: '',
    cover_letter_url: '',
    custom_answers: {},
    submission_screenshot: '',
    applied_date: null as unknown,
    response_date: null as unknown,
    response_type: '',
    response_raw: '',
    interview_date: null as unknown,
    interviewer_names: [],
    interview_format: '',
    interview_notes: '',
    user_notes: '',
    thank_you_sent: null as unknown,
    followup_sent: null as unknown,
    referral_available: referral.available,
    referral_contact: referral.contact,
  };
}
