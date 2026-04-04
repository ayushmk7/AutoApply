/**
 * Phase 5.4 — lightweight link check (batch-friendly); not full Playwright.
 */
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 12_000;

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  if (h === 'metadata.google.internal') return true;
  return false;
}

export async function checkJobLinkHealth(url: string): Promise<number | null> {
  if (!url || !/^https?:\/\//i.test(url)) {
    return null;
  }
  let current = url;
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }
    if (isPrivateHost(parsed.hostname)) {
      return null;
    }

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(current, {
        method: 'HEAD',
        redirect: 'manual',
        signal: ac.signal,
        headers: { 'User-Agent': 'AutoApplyBot/1.0 (+https://github.com)' },
      });
      clearTimeout(t);

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return res.status;
        current = new URL(loc, current).toString();
        continue;
      }
      return res.status;
    } catch {
      clearTimeout(t);
      return null;
    }
  }
  return null;
}
