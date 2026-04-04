import type { AtsTypeHint } from '../types/listing.js';

export function detectAtsTypeFromUrl(url: string): AtsTypeHint {
  const u = url.toLowerCase();
  if (u.includes('greenhouse.io') || u.includes('job-boards.greenhouse.io')) return 'greenhouse';
  if (u.includes('lever.co') || u.includes('jobs.lever.co')) return 'lever';
  if (u.includes('myworkdayjobs.com') || u.includes('workday.com')) return 'workday';
  if (u.includes('icims.com')) return 'icims';
  if (u.includes('smartrecruiters.com')) return 'smartrecruiters';
  return 'unknown';
}
