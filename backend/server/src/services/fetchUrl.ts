import { setTimeout as delay } from 'node:timers/promises';
import { logger } from '../lib/logger.js';
import { HttpError } from '../lib/httpError.js';
import { assertUrlSafeForFetch } from './ssrfGuard.js';

const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_UA =
  'Mozilla/5.0 (compatible; AutoApplyBot/1.0; +https://autoapply.local) AppleWebKit/537.36';

export type FetchUrlClassification = 'ok' | 'login_wall' | 'rate_limited' | 'blocked_region' | 'blocked';

export interface SafeFetchHtmlResult {
  finalUrl: string;
  html: string;
  status: number;
  classification: FetchUrlClassification;
}

function isTextualContentType(ct: string | null): boolean {
  if (!ct) return true;
  const lower = ct.split(';')[0]?.trim().toLowerCase() ?? '';
  return (
    lower.includes('text/html') ||
    lower.includes('text/plain') ||
    lower.includes('application/xhtml+xml') ||
    lower.includes('application/json')
  );
}

async function readTextWithCap(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    return '';
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel().catch(() => {});
        throw new HttpError(400, 'Downloaded page exceeds size limit.', 'TIMEOUT');
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Phase 10.2 — plain HTTP fetch after SSRF checks; capped redirects and bytes.
 */
export async function fetchUrlHtml(
  startUrl: string,
  requestId: string
): Promise<SafeFetchHtmlResult> {
  let current = (await assertUrlSafeForFetch(startUrl)).toString();
  let lastStatus = 0;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const urlObj = await assertUrlSafeForFetch(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    let res: Response;
    try {
      res = await fetch(urlObj, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': DEFAULT_UA,
          accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1',
        },
      });
    } catch (err) {
      logger.warn({ err, requestId, url: urlObj.toString() }, 'fetch_url_failed');
      throw new HttpError(502, 'Failed to fetch URL.', 'TIMEOUT');
    } finally {
      clearTimeout(timer);
    }

    lastStatus = res.status;

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc || hop === MAX_REDIRECTS) {
        return {
          finalUrl: urlObj.toString(),
          html: '',
          status: res.status,
          classification: 'blocked',
        };
      }
      current = new URL(loc, urlObj).toString();
      continue;
    }

    if (res.status === 401 || res.status === 403 || res.status === 407) {
      return {
        finalUrl: urlObj.toString(),
        html: '',
        status: res.status,
        classification: 'login_wall',
      };
    }

    if (res.status === 429) {
      await delay(1500);
      const retryController = new AbortController();
      const retryTimer = setTimeout(() => retryController.abort(), 25_000);
      try {
        res = await fetch(urlObj, {
          redirect: 'manual',
          signal: retryController.signal,
          headers: {
            'user-agent': DEFAULT_UA,
            accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1',
          },
        });
      } catch {
        return {
          finalUrl: urlObj.toString(),
          html: '',
          status: 429,
          classification: 'rate_limited',
        };
      } finally {
        clearTimeout(retryTimer);
      }
      lastStatus = res.status;
      if (res.status === 429) {
        return {
          finalUrl: urlObj.toString(),
          html: '',
          status: 429,
          classification: 'rate_limited',
        };
      }
    }

    const ct = res.headers.get('content-type');
    if (!isTextualContentType(ct)) {
      throw new HttpError(400, 'URL did not return a text or HTML document.', 'FETCH_BLOCKED');
    }

    const html = await readTextWithCap(res);
    return {
      finalUrl: urlObj.toString(),
      html,
      status: lastStatus || res.status,
      classification: 'ok',
    };
  }

  return { finalUrl: current, html: '', status: lastStatus, classification: 'blocked' };
}
