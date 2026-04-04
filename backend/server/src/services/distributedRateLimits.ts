import { config } from '../lib/config.js';
import { getQuotaRedis, utcHourKey } from '../lib/redisQuota.js';
import { logger } from '../lib/logger.js';

/**
 * Phase 16 — per ATS registrable-domain hourly cap using Redis (`docs/03_BACKEND_PRD.md` §4.3).
 */
export async function tryConsumeAtsDomainHourlySlot(
  listingUrl: string,
  isDemo: boolean,
  requestId: string
): Promise<{ ok: true } | { ok: false; domain: string }> {
  const cap = isDemo ? config.demoAtsDomainHourlyCap : config.atsDomainHourlyCap;
  const domain = registrableHostFromUrl(listingUrl);
  if (!domain) return { ok: true };

  const r = getQuotaRedis();
  if (!r) return { ok: true };

  const hour = utcHourKey();
  const key = `quota:ats:${domain}:${hour}`;
  try {
    const n = await r.incr(key);
    if (n === 1) {
      await r.pexpire(key, config.atsDomainQuotaTtlMs);
    }
    if (n > cap) {
      await r.decr(key);
      logger.info({ requestId, domain, cap }, 'ats_domain_hourly_cap_exceeded');
      return { ok: false, domain };
    }
    return { ok: true };
  } catch (err) {
    logger.warn({ err, requestId }, 'ats_domain_quota_redis_error');
    return { ok: true };
  }
}

export function registrableHostFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (!host) return null;
    const parts = host.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return host;
  } catch {
    return null;
  }
}
