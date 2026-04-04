import type { ProfileCv, ProfilePreferences, ProfileQuestionnaire } from '../types/profile.js';

export function hasStructuredCv(cv: ProfileCv): boolean {
  const edu = cv.education.some((e) => e.school?.trim().length > 0);
  const exp = cv.experience.some((e) => e.company?.trim() && e.role?.trim());
  return edu || exp;
}

/** Phase 4.6 — minimum data before AgentMail provisioning. */
export function isProfileReadyForAgentmail(
  cv: ProfileCv,
  questionnaire: ProfileQuestionnaire,
  preferences: ProfilePreferences
): boolean {
  if (!hasStructuredCv(cv)) return false;
  if (preferences.daily_limit <= 0) return false;
  const hasAvailability =
    questionnaire.availability.start_date?.trim().length > 0 ||
    (questionnaire.availability.terms?.length ?? 0) > 0 ||
    (questionnaire.availability.locations?.length ?? 0) > 0;
  return hasAvailability;
}
