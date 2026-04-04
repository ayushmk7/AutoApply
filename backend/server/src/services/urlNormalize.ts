/**
 * Phase 5.1 — URL normalization for deduping (tracking params, scheme).
 */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'fbclid',
  'gclid',
  'mc_eid',
  'igshid',
]);

export function normalizeJobUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return trimmed;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return trimmed;
  }
  u.hash = '';
  for (const p of TRACKING_PARAMS) {
    u.searchParams.delete(p);
  }
  u.hostname = u.hostname.toLowerCase();
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '');
  }
  return u.toString();
}

export function listingDedupeKey(company: string, role: string, url: string): string {
  const c = company.trim().toLowerCase();
  const r = role.trim().toLowerCase();
  const u = normalizeJobUrl(url);
  return `${c}|${r}|${u}`;
}
