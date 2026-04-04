import Anthropic from '@anthropic-ai/sdk';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { ProfileCv } from '../types/profile.js';
import type { ListingSource } from '../types/listing.js';

const MODEL = 'claude-sonnet-4-20250514';

function stripJsonFences(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence) return fence[1].trim();
  return t;
}

function getClient(): Anthropic {
  const key = config.anthropicApiKey;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey: key });
}

async function completeJson(system: string, user: string): Promise<string> {
  const client = getClient();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: system,
    messages: [{ role: 'user', content: user }],
  });
  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('claude_empty_response');
  }
  return block.text;
}

/** Phase 4.2 — structured CV JSON only; no surrounding prose. */
export async function claudeParseCvToJson(cvPlainText: string, requestId: string): Promise<ProfileCv> {
  const system = `You convert resume/CV plain text into a single JSON object matching this TypeScript shape exactly (use [] for empty arrays, "" for empty strings):
{
  "education": [{ "school": "", "degree": "", "major": "", "gpa": "", "graduation": "", "coursework": [], "honors": [] }],
  "experience": [{ "company": "", "role": "", "dates": "", "bullets": [], "skills_used": [] }],
  "projects": [{ "name": "", "description": "", "tech_stack": [], "bullets": [] }],
  "skills": { "languages": [], "frameworks": [], "tools": [], "other": [] },
  "extracurriculars": [],
  "awards": [],
  "publications": [],
  "certifications": []
}
Respond with JSON only. Cap bullets per experience at 25. Do not invent employers or degrees not supported by the text; use empty strings/arrays when unknown.`;

  const raw = await completeJson(system, `CV text:\n\n${cvPlainText.slice(0, 120_000)}`);
  try {
    return JSON.parse(stripJsonFences(raw)) as ProfileCv;
  } catch (err) {
    logger.error({ err, requestId }, 'claude_cv_json_parse_failed');
    throw new Error('claude_cv_invalid_json');
  }
}

export interface ParsedListingRow {
  company: string;
  role: string;
  location: string;
  url: string;
  description: string;
  posted_date?: string | null;
  requires_cover_letter?: boolean;
  parse_confidence?: number;
}

/** Phase 5.2/5.3 — extract job rows from internship repo markdown. */
export async function claudeParseListingsFromMarkdown(
  markdown: string,
  sourceHint: string,
  requestId: string
): Promise<ParsedListingRow[]> {
  const system = `You extract structured internship/job rows from GitHub README-style markdown tables and bullet lists.
Return a JSON array only. Each item:
{ "company": string, "role": string, "location": string, "url": string, "description": string (concise), "posted_date": string | null (ISO date if known), "requires_cover_letter": boolean, "parse_confidence": number 0-1 }
Skip non-job rows. If URL is missing but can be inferred from markdown link near the row, use it; else use "".
Source repo hint: ${sourceHint}`;

  const raw = await completeJson(system, `Markdown:\n\n${markdown.slice(0, 200_000)}`);
  try {
    const parsed = JSON.parse(stripJsonFences(raw));
    if (!Array.isArray(parsed)) {
      throw new Error('not_array');
    }
    return parsed as ParsedListingRow[];
  } catch (err) {
    logger.error({ err, requestId }, 'claude_listings_json_parse_failed');
    throw new Error('claude_listings_invalid_json');
  }
}

export interface GhostUrgencyResult {
  ghost_score: number;
  ghost_reasons: string[];
  urgency_score: number;
  urgency_label: string;
}

/** Phase 5.4 — ghost probability + urgency label in one call. */
export async function claudeGhostAndUrgency(
  listingSummary: string,
  requestId: string
): Promise<GhostUrgencyResult> {
  const system = `You assess whether a job posting is likely a "ghost" (stale, reposted, or low legitimacy) and an urgency score for applying soon.
Return JSON only: { "ghost_score": number 0-100, "ghost_reasons": string[] (short), "urgency_score": number 0-100, "urgency_label": string (e.g. "high", "medium", "low") }`;

  const raw = await completeJson(system, `Job listing:\n${listingSummary.slice(0, 16_000)}`);
  try {
    const o = JSON.parse(stripJsonFences(raw)) as GhostUrgencyResult;
    return {
      ghost_score: Math.max(0, Math.min(100, Number(o.ghost_score) || 0)),
      ghost_reasons: Array.isArray(o.ghost_reasons) ? o.ghost_reasons.map(String) : [],
      urgency_score: Math.max(0, Math.min(100, Number(o.urgency_score) || 0)),
      urgency_label: typeof o.urgency_label === 'string' ? o.urgency_label : 'medium',
    };
  } catch (err) {
    logger.error({ err, requestId }, 'claude_ghost_json_parse_failed');
    return {
      ghost_score: 0,
      ghost_reasons: [],
      urgency_score: 50,
      urgency_label: 'medium',
    };
  }
}

export interface NormalizedConnection {
  company_normalized: string;
  company_raw: string;
  name?: string;
}

/** Phase 4.4 — normalize company names from LinkedIn CSV rows. */
export async function claudeNormalizeLinkedInCompanies(
  rows: { company: string; name?: string }[],
  requestId: string
): Promise<NormalizedConnection[]> {
  const system = `Normalize company names for deduplication. Return JSON only: array of { "company_normalized": string, "company_raw": string, "name": string optional } in the same order as input.`;

  const raw = await completeJson(
    system,
    `Rows JSON: ${JSON.stringify(rows.slice(0, 2000)).slice(0, 120_000)}`
  );
  try {
    const parsed = JSON.parse(stripJsonFences(raw));
    if (!Array.isArray(parsed)) throw new Error('not_array');
    return parsed as NormalizedConnection[];
  } catch (err) {
    logger.error({ err, requestId }, 'claude_linkedin_json_parse_failed');
    return rows.map((r) => ({
      company_normalized: r.company.trim(),
      company_raw: r.company,
      name: r.name,
    }));
  }
}

export function mapRepoToListingSource(owner: string, repo: string): ListingSource {
  const full = `${owner}/${repo}`.toLowerCase();
  if (full.includes('pittcsc')) return 'pittcsc';
  if (full.includes('reavnail')) return 'reavnail';
  if (owner.toLowerCase() === 'simplifyjobs') return 'simplify';
  return 'simplify';
}

export interface FitScoreResult {
  fit_score: number;
  reasoning: string;
}

/**
 * Phase 6.1 — `fit_score` prompt (Technical PRD §6.2 `fit_score`).
 * Truncate inputs to control token budget; batching is handled at the caller (per listing × user).
 */
export async function claudeFitScore(
  profileSummary: string,
  listingSummary: string,
  requestId: string
): Promise<FitScoreResult> {
  const system = `You score how well a job listing fits a candidate profile for an internship/new-grad style role.
Return JSON only: { "fit_score": number 0-100, "reasoning": string (one short sentence) }
Be conservative: if information is sparse, score lower.`;

  const raw = await completeJson(
    system,
    `Profile summary:\n${profileSummary.slice(0, 12_000)}\n\nJob listing:\n${listingSummary.slice(0, 12_000)}`
  );
  try {
    const o = JSON.parse(stripJsonFences(raw)) as FitScoreResult;
    return {
      fit_score: Math.max(0, Math.min(100, Number(o.fit_score) || 0)),
      reasoning: typeof o.reasoning === 'string' ? o.reasoning.slice(0, 500) : '',
    };
  } catch (err) {
    logger.error({ err, requestId }, 'claude_fit_score_json_parse_failed');
    return { fit_score: 0, reasoning: 'parse_error' };
  }
}
