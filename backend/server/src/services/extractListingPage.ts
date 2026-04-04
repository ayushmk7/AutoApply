import * as cheerio from 'cheerio';
import {
  claudeExtractListingFromContent,
  type ExtractedListingNormalized,
} from './claudeApply.js';

function isJobPostingNode(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const o = node as Record<string, unknown>;
  const t = o['@type'];
  if (t === 'JobPosting') return true;
  if (Array.isArray(t) && t.includes('JobPosting')) return true;
  return false;
}

function collectJobPostingObjects(root: unknown, out: Record<string, unknown>[]): void {
  if (!root) return;
  if (Array.isArray(root)) {
    for (const x of root) collectJobPostingObjects(x, out);
    return;
  }
  if (typeof root !== 'object') return;
  const o = root as Record<string, unknown>;
  if (isJobPostingNode(o)) out.push(o);
  if (Array.isArray(o['@graph'])) {
    for (const x of o['@graph'] as unknown[]) collectJobPostingObjects(x, out);
  }
}

function bestJsonLdHint(html: string): string {
  const $ = cheerio.load(html);
  const candidates: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      collectJobPostingObjects(parsed, candidates);
    } catch {
      /* ignore */
    }
  });
  if (candidates.length === 0) return '';
  const scored = candidates.map((c) => {
    const title = String(c.title ?? '');
    const desc = String(c.description ?? '');
    const score = title.length + Math.min(desc.length, 2000);
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return JSON.stringify(scored[0]?.c ?? candidates[0]).slice(0, 12_000);
}

function openGraphHints(html: string): { ogTitle?: string; ogDescription?: string } {
  const $ = cheerio.load(html);
  const meta = (prop: string) =>
    $(`meta[property="${prop}"]`).attr('content') ||
    $(`meta[name="${prop}"]`).attr('content') ||
    undefined;
  return {
    ogTitle: meta('og:title'),
    ogDescription: meta('og:description'),
  };
}

function mainVisibleText(html: string): string {
  const $ = cheerio.load(html);
  $('script,noscript,style,template,svg').remove();
  const text = $('body').text() || $.root().text();
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Phase 10.3 — JSON-LD JobPosting, Open Graph, readability-style text, then Claude normalization.
 */
export async function extractListingFromHtml(
  html: string,
  pageUrl: string,
  requestId: string
): Promise<ExtractedListingNormalized> {
  const jsonLd = bestJsonLdHint(html);
  const og = openGraphHints(html);
  const mainText = mainVisibleText(html).slice(0, 120_000);

  return claudeExtractListingFromContent(
    mainText,
    { jsonLd: jsonLd || undefined, ogTitle: og.ogTitle, ogDescription: og.ogDescription, pageUrl },
    requestId
  );
}

/** Phase 10.4 — re-run extraction on pasted JD only (no fetch). */
export async function extractListingFromPlainText(
  text: string,
  pageUrl: string,
  requestId: string
): Promise<ExtractedListingNormalized> {
  const trimmed = text.trim().slice(0, 120_000);
  return claudeExtractListingFromContent(trimmed, { pageUrl }, requestId);
}
