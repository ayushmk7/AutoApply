/**
 * Phase 6.1 — referral path from LinkedIn connections vs listing company (Technical PRD `match_and_queue`).
 */

function connectionCompany(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const o = row as Record<string, unknown>;
  const c = o.company_normalized ?? o.company ?? o.Company ?? '';
  return String(c).trim().toLowerCase();
}

function connectionName(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const o = row as Record<string, unknown>;
  const n = o.name ?? o.Name ?? '';
  return String(n).trim();
}

export function findReferralForCompany(
  connections: unknown[] | undefined,
  listingCompany: string
): { available: boolean; contact: string } {
  const lc = listingCompany.trim().toLowerCase();
  if (!lc || !connections?.length) {
    return { available: false, contact: '' };
  }

  for (const row of connections) {
    const cc = connectionCompany(row);
    if (!cc) continue;
    if (lc.includes(cc) || cc.includes(lc)) {
      const name = connectionName(row);
      return { available: true, contact: name || cc };
    }
  }

  return { available: false, contact: '' };
}
