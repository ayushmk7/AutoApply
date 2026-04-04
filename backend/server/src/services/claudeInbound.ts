import Anthropic from '@anthropic-ai/sdk';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

const MODEL = 'claude-sonnet-4-20250514';

export type InboundEmailCategory = 'rejection' | 'interview' | 'info_request' | 'auto_reply';

export interface InboundClassification {
  category: InboundEmailCategory;
  rejection_subtype?: 'auto_screen' | 'post_review';
  interview_iso?: string;
  interviewer_names?: string[];
  interview_format?: string;
  summary: string;
}

function getClient(): Anthropic {
  const key = config.anthropicApiKey;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey: key });
}

/**
 * Phase 14.3 — `classify_response` step (`docs/02_TECHNICAL_PRD.md` process_response).
 */
export async function claudeClassifyInboundEmail(
  subject: string,
  body: string,
  requestId: string
): Promise<InboundClassification> {
  if (config.mockClassifyInboundEmail) {
    return {
      category: 'info_request',
      summary: 'mock classification',
    };
  }

  const system = `You classify recruiter/employer emails to a job applicant.
Return ONLY compact JSON (no markdown) with keys:
- category: one of rejection | interview | info_request | auto_reply
- rejection_subtype: optional auto_screen | post_review (only if category is rejection)
- interview_iso: optional ISO-8601 datetime if a specific interview time is proposed
- interviewer_names: optional string array
- interview_format: optional short string (phone|video|onsite|unknown)
- summary: one short human sentence`;

  const user = `Subject: ${subject.slice(0, 500)}
Body:
${body.slice(0, 12_000)}`;

  const client = getClient();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    logger.warn({ requestId }, 'claude_inbound_classify_empty');
    throw new Error('claude_inbound_classify_empty');
  }

  const raw = block.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    logger.warn({ err, requestId, raw: raw.slice(0, 200) }, 'claude_inbound_classify_json');
    return { category: 'info_request', summary: 'Could not parse classifier output.' };
  }

  const cat = String(parsed.category ?? 'info_request') as InboundEmailCategory;
  const allowed: InboundEmailCategory[] = ['rejection', 'interview', 'info_request', 'auto_reply'];
  const category = allowed.includes(cat) ? cat : 'info_request';

  return {
    category,
    rejection_subtype:
      parsed.rejection_subtype === 'post_review' || parsed.rejection_subtype === 'auto_screen'
        ? parsed.rejection_subtype
        : undefined,
    interview_iso: typeof parsed.interview_iso === 'string' ? parsed.interview_iso : undefined,
    interviewer_names: Array.isArray(parsed.interviewer_names)
      ? (parsed.interviewer_names as unknown[]).map((x) => String(x))
      : undefined,
    interview_format: typeof parsed.interview_format === 'string' ? parsed.interview_format : undefined,
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Inbound email received.',
  };
}
