import Anthropic from '@anthropic-ai/sdk';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { ListingDocument } from '../types/listing.js';

const MODEL = 'claude-sonnet-4-20250514';

function getClient(): Anthropic {
  const key = config.anthropicApiKey;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey: key });
}

async function completeText(system: string, user: string, requestId: string): Promise<string> {
  const client = getClient();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    logger.warn({ requestId }, 'claude_interview_empty_response');
    throw new Error('claude_interview_empty_response');
  }
  return block.text.trim();
}

export interface InterviewEmailDraft {
  subject: string;
  text: string;
  html: string;
}

function asHtmlParagraphs(text: string): string {
  const paras = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) {
    return `<p>${escapeHtml(text)}</p>`;
  }
  return paras.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`).join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Phase 12 — interview confirmation email draft. */
export async function claudeDraftInterviewConfirmation(
  listing: ListingDocument,
  selectedIso: string,
  candidateName: string,
  requestId: string
): Promise<InterviewEmailDraft> {
  const system = `You draft a short, professional email confirming an interview time.
Respond with exactly three lines in this format (no markdown fences):
SUBJECT: <one line>
BODY:
<email body, plain text, 2–4 short paragraphs, warm and concise>`;

  const user = `Role: ${listing.role}
Company: ${listing.company || 'Company'}
Candidate name to sign as: ${candidateName || 'Candidate'}
Confirmed interview time (ISO): ${selectedIso}
Job description excerpt:\n${(listing.description || '').slice(0, 6000)}`;

  const raw = await completeText(system, user, requestId);
  const subjMatch = /^SUBJECT:\s*(.+)$/im.exec(raw);
  const bodyMatch = /^BODY:\s*([\s\S]+)$/im.exec(raw);
  const subject = (subjMatch?.[1] ?? `Interview confirmation — ${listing.role}`).trim();
  const text = (bodyMatch?.[1] ?? raw).trim();
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${asHtmlParagraphs(
    text
  )}</div>`;
  return { subject, text, html };
}

export interface InterviewPrepPack {
  summary: string;
  talking_points: string[];
  questions_to_ask: string[];
  technical_topics: string[];
}

/** Phase 12 — prep materials from listing + optional resume bullets (no full CV in prompt). */
export async function claudeInterviewPrepPack(
  listing: ListingDocument,
  resumeHint: string,
  requestId: string
): Promise<InterviewPrepPack> {
  const system = `You produce interview prep as JSON only (no prose outside JSON):
{
  "summary": "string, 2-3 sentences",
  "talking_points": ["string", "..."],
  "questions_to_ask": ["string", "..."],
  "technical_topics": ["string", "..."]
}
Max 8 items per array. No PII beyond what is in the job description.`;

  const user = `Job title: ${listing.role}
Company: ${listing.company || ''}
Location: ${listing.location || ''}
Description:\n${(listing.description || '').slice(0, 12_000)}
Candidate resume highlights (optional, may be empty):\n${resumeHint.slice(0, 4000)}`;

  const raw = await completeText(system, user, requestId);
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim()) as InterviewPrepPack;
    return {
      summary: String(parsed.summary ?? ''),
      talking_points: Array.isArray(parsed.talking_points) ? parsed.talking_points.map(String) : [],
      questions_to_ask: Array.isArray(parsed.questions_to_ask) ? parsed.questions_to_ask.map(String) : [],
      technical_topics: Array.isArray(parsed.technical_topics) ? parsed.technical_topics.map(String) : [],
    };
  } catch (err) {
    logger.error({ err, requestId }, 'claude_interview_prep_json_failed');
    throw new Error('claude_interview_prep_invalid_json');
  }
}

export async function claudeDraftThankYouEmail(
  listing: ListingDocument,
  requestId: string
): Promise<InterviewEmailDraft> {
  const system = `Draft a concise post-interview thank-you email. Output format (no markdown):
SUBJECT: <one line>
BODY:
<plain text body>`;

  const user = `Role: ${listing.role}
Company: ${listing.company || 'Company'}`;

  const raw = await completeText(system, user, requestId);
  const subjMatch = /^SUBJECT:\s*(.+)$/im.exec(raw);
  const bodyMatch = /^BODY:\s*([\s\S]+)$/im.exec(raw);
  const subject = (subjMatch?.[1] ?? `Thank you — ${listing.role}`).trim();
  const text = (bodyMatch?.[1] ?? raw).trim();
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${asHtmlParagraphs(
    text
  )}</div>`;
  return { subject, text, html };
}

export async function claudeDraftFollowUpEmail(
  listing: ListingDocument,
  requestId: string
): Promise<InterviewEmailDraft> {
  const system = `Draft a polite, brief follow-up email checking on application status after a thank-you was sent.
Output format (no markdown):
SUBJECT: <one line>
BODY:
<plain text body>`;

  const user = `Role: ${listing.role}
Company: ${listing.company || 'Company'}`;

  const raw = await completeText(system, user, requestId);
  const subjMatch = /^SUBJECT:\s*(.+)$/im.exec(raw);
  const bodyMatch = /^BODY:\s*([\s\S]+)$/im.exec(raw);
  const subject = (subjMatch?.[1] ?? `Following up — ${listing.role}`).trim();
  const text = (bodyMatch?.[1] ?? raw).trim();
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${asHtmlParagraphs(
    text
  )}</div>`;
  return { subject, text, html };
}
