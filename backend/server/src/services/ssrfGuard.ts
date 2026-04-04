import dns from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';
import { HttpError } from '../lib/httpError.js';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
]);

function ipv4Parts(ip: string): number[] | null {
  if (!isIPv4(ip)) return null;
  return ip.split('.').map((x) => Number(x));
}

function isBlockedIpv4(ip: string): boolean {
  const p = ipv4Parts(ip);
  if (!p) return false;
  const [a, b] = p;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 255) return true;
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  if (!isIPv6(ip)) return false;
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.replace(/^::ffff:/, '');
    return isBlockedIpv4(v4);
  }
  return false;
}

async function assertResolvedAddressesSafe(hostname: string): Promise<void> {
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    for (const r of results) {
      if (isBlockedIpv4(r.address) || isBlockedIpv6(r.address)) {
        throw new HttpError(400, 'URL resolves to a disallowed network address.', 'SSRF_BLOCKED');
      }
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'Could not resolve URL host.', 'INVALID_URL');
  }
}

/**
 * Phase 10.1 — block private ranges, metadata IPs, non-http(s), unsafe schemes.
 */
export async function assertUrlSafeForFetch(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    throw new HttpError(400, 'Malformed URL.', 'INVALID_URL');
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new HttpError(400, 'Only http and https URLs are allowed.', 'UNSUPPORTED_SCHEME');
  }

  const host = u.hostname.toLowerCase();
  if (!host) {
    throw new HttpError(400, 'URL host is missing.', 'INVALID_URL');
  }
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new HttpError(400, 'URL host is not allowed.', 'SSRF_BLOCKED');
  }
  if (host === '169.254.169.254' || host.endsWith('.local')) {
    throw new HttpError(400, 'URL host is not allowed.', 'SSRF_BLOCKED');
  }

  if (isIPv4(host) || isIPv6(host)) {
    if (isBlockedIpv4(host) || isBlockedIpv6(host)) {
      throw new HttpError(400, 'URL resolves to a disallowed network address.', 'SSRF_BLOCKED');
    }
    return u;
  }

  await assertResolvedAddressesSafe(host);
  return u;
}
