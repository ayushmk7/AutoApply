import type { ProfileDocument } from '../types/profile.js';

/**
 * Phase 6.1 — compact text for Claude fit scoring (token budget).
 */
export function buildProfileSummaryForMatch(user: ProfileDocument): string {
  const parts: string[] = [];
  parts.push(`Email: ${user.email || ''}`);
  if (user.questionnaire?.availability) {
    parts.push(`Availability: ${JSON.stringify(user.questionnaire.availability).slice(0, 2000)}`);
  }
  if (user.cv) {
    parts.push(`CV JSON (truncated): ${JSON.stringify(user.cv).slice(0, 10_000)}`);
  }
  return parts.join('\n\n');
}

export function userHasMatchableProfile(user: ProfileDocument): boolean {
  const exp = user.cv?.experience?.length ?? 0;
  const proj = user.cv?.projects?.length ?? 0;
  const edu = user.cv?.education?.length ?? 0;
  return exp > 0 || proj > 0 || edu > 0;
}
