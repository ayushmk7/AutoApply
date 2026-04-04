import Anthropic from '@anthropic-ai/sdk';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { ProfileCv, ProfileQuestionnaire } from '../types/profile.js';

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
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('claude_empty_response');
  }
  return block.text;
}

export interface JobAnalysis {
  required_skills: string[];
  preferred_skills: string[];
  company_context: string;
  custom_questions: { id: string; prompt: string }[];
  requires_cover_letter: boolean;
  jd_language?: string;
  needs_manual_review: boolean;
}

/** Phase 8.1 */
export async function claudeAnalyzeJob(
  jobDescription: string,
  requestId: string
): Promise<JobAnalysis> {
  const system = `You analyze a job description for an internship application assistant.
Return JSON only with this shape:
{
  "required_skills": string[],
  "preferred_skills": string[],
  "company_context": string (short),
  "custom_questions": { "id": string, "prompt": string }[],
  "requires_cover_letter": boolean,
  "jd_language": string (ISO-ish label, e.g. "en"),
  "needs_manual_review": boolean (true if JD is extremely short or unusable)
}`;

  const raw = await completeJson(system, `Job description:\n\n${jobDescription.slice(0, 48_000)}`);
  try {
    const o = JSON.parse(stripJsonFences(raw)) as JobAnalysis;
    return {
      required_skills: Array.isArray(o.required_skills) ? o.required_skills.map(String) : [],
      preferred_skills: Array.isArray(o.preferred_skills) ? o.preferred_skills.map(String) : [],
      company_context: typeof o.company_context === 'string' ? o.company_context : '',
      custom_questions: Array.isArray(o.custom_questions)
        ? o.custom_questions.map((q, i) => ({
            id: typeof q?.id === 'string' ? q.id : `q${i}`,
            prompt: typeof q?.prompt === 'string' ? q.prompt : String(q),
          }))
        : [],
      requires_cover_letter: Boolean(o.requires_cover_letter),
      jd_language: typeof o.jd_language === 'string' ? o.jd_language : 'en',
      needs_manual_review: Boolean(o.needs_manual_review),
    };
  } catch (err) {
    logger.error({ err, requestId }, 'claude_analyze_job_parse_failed');
    return {
      required_skills: [],
      preferred_skills: [],
      company_context: '',
      custom_questions: [],
      requires_cover_letter: false,
      jd_language: 'unknown',
      needs_manual_review: true,
    };
  }
}

/** Phase 8.2 — LaTeX body only (no preamble). */
export async function claudeGenerateResumeLatex(
  cv: ProfileCv,
  analysis: JobAnalysis,
  listingTitle: string,
  company: string,
  feedback?: string,
  requestId?: string
): Promise<string> {
  const system = `You write LaTeX resume BODY content only for an article-class CV (no \\documentclass, no preamble).
Use sections like \\section*{Education}, \\section*{Experience} with \\textbf{} and \\begin{itemize} lists.
Tailor ordering and bullets to the job; stay truthful to the provided CV JSON — do not invent employers, degrees, or dates.
Respond with LaTeX only, no markdown fences.${feedback ? ' Incorporate the ATS feedback in a revised version.' : ''}`;

  const user = `Target role title: ${listingTitle}\nCompany: ${company}\nRequired skills: ${analysis.required_skills.join(', ')}\nPreferred: ${analysis.preferred_skills.join(', ')}\nCV JSON:\n${JSON.stringify(cv).slice(0, 60_000)}${feedback ? `\n\nFeedback:\n${feedback}` : ''}`;

  const raw = await completeJson(system, user);
  return stripJsonFences(raw).replace(/^```[a-z]*\s*/i, '').replace(/```$/i, '').trim();
}

export interface ResumeValidation {
  ok: boolean;
  issues: string[];
}

/** Phase 8.2 — validation pass vs CV JSON. */
export async function claudeValidateResumeAgainstCv(
  cv: ProfileCv,
  latexBody: string,
  requestId: string
): Promise<ResumeValidation> {
  const system = `You verify that a LaTeX resume body does not invent employers, roles, degrees, or dates not supported by the CV JSON.
Return JSON only: { "ok": boolean, "issues": string[] }`;

  const raw = await completeJson(
    system,
    `CV JSON:\n${JSON.stringify(cv).slice(0, 40_000)}\n\nLaTeX body:\n${latexBody.slice(0, 24_000)}`
  );
  try {
    const o = JSON.parse(stripJsonFences(raw)) as ResumeValidation;
    return {
      ok: Boolean(o.ok),
      issues: Array.isArray(o.issues) ? o.issues.map(String) : [],
    };
  } catch (err) {
    logger.error({ err, requestId }, 'claude_resume_validate_parse_failed');
    return { ok: false, issues: ['validation_parse_failed'] };
  }
}

export interface AtsScoreResult {
  score: number;
  matched: string[];
  missing: string[];
  suggestions: string;
}

/** Phase 8.4 */
export async function claudeAtsScore(
  resumePlainText: string,
  jobDescription: string,
  requestId: string
): Promise<AtsScoreResult> {
  const system = `You score resume fit against a job description by keyword and semantic overlap for ATS-style screening.
Return JSON only: { "score": number 0-100, "matched": string[], "missing": string[], "suggestions": string (short) }
If resume text is empty or unusable, set score below 40 and explain in suggestions.`;

  const raw = await completeJson(
    system,
    `Resume text:\n${resumePlainText.slice(0, 24_000)}\n\nJob:\n${jobDescription.slice(0, 24_000)}`
  );
  try {
    const o = JSON.parse(stripJsonFences(raw)) as AtsScoreResult;
    return {
      score: Math.max(0, Math.min(100, Number(o.score) || 0)),
      matched: Array.isArray(o.matched) ? o.matched.map(String) : [],
      missing: Array.isArray(o.missing) ? o.missing.map(String) : [],
      suggestions: typeof o.suggestions === 'string' ? o.suggestions : '',
    };
  } catch (err) {
    logger.error({ err, requestId }, 'claude_ats_score_parse_failed');
    return { score: 0, matched: [], missing: [], suggestions: 'parse_error' };
  }
}

/** Phase 8.3 — attempt to fix LaTeX using compiler log excerpt. */
export async function claudeFixLatexFromLog(
  texSource: string,
  logExcerpt: string,
  requestId: string
): Promise<string> {
  const system = `You fix LaTeX source so pdflatex can compile. Return the FULL corrected .tex source only, no fences.`;
  const raw = await completeJson(
    system,
    `Failing TeX:\n${texSource.slice(0, 40_000)}\n\nLog excerpt:\n${logExcerpt.slice(0, 8000)}`
  );
  return stripJsonFences(raw).replace(/^```[a-z]*\s*/i, '').replace(/```$/i, '').trim();
}

/** Phase 8.5 */
export async function claudeGenerateCoverLetter(
  jobDescription: string,
  cv: ProfileCv,
  resumeLatexBody: string,
  requestId: string
): Promise<string> {
  const system = `Write a concise professional cover letter (plain text, paragraphs). Do not repeat resume bullets verbatim; add motivation and fit narrative.`;

  const raw = await completeJson(
    system,
    `Job:\n${jobDescription.slice(0, 12_000)}\n\nResume LaTeX body (for tone only):\n${resumeLatexBody.slice(0, 8000)}\n\nCV JSON:\n${JSON.stringify(cv).slice(0, 8000)}`
  );
  return stripJsonFences(raw).trim();
}

/** Phase 8.6 */
export async function claudeGenerateCustomAnswers(
  questions: { id: string; prompt: string }[],
  questionnaire: ProfileQuestionnaire,
  cv: ProfileCv,
  requestId: string
): Promise<Record<string, string>> {
  const system = `Answer job application custom questions using the questionnaire essays and CV JSON.
Return JSON only as an object mapping question id -> answer string. Keep each answer within typical ATS limits (<= 2000 chars each unless question demands longer). Flag low confidence by starting answer with "[review] " if needed.`;

  const raw = await completeJson(
    system,
    `Questions:\n${JSON.stringify(questions).slice(0, 8000)}\n\nQuestionnaire:\n${JSON.stringify(questionnaire).slice(0, 12_000)}\n\nCV:\n${JSON.stringify(cv).slice(0, 12_000)}`
  );
  try {
    const o = JSON.parse(stripJsonFences(raw)) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') {
        out[k] = v.slice(0, 4000);
      }
    }
    return out;
  } catch (err) {
    logger.error({ err, requestId }, 'claude_custom_answers_parse_failed');
    return {};
  }
}

export interface ExtractedListingNormalized {
  title: string;
  company: string | null;
  location: string;
  description: string;
  application_url: string;
  inferred_custom_questions: { prompt: string }[];
  requires_cover_letter: boolean;
  confidence: number;
}

/** Phase 10.3 — normalize listing from page text + structured hints. */
export async function claudeExtractListingFromContent(
  mainText: string,
  hints: { jsonLd?: string; ogTitle?: string; ogDescription?: string; pageUrl: string },
  requestId: string
): Promise<ExtractedListingNormalized> {
  const system = `You extract a normalized job listing from noisy web text and optional structured hints.
Return JSON only:
{
  "title": string,
  "company": string | null,
  "location": string,
  "description": string (full JD text, trimmed but detailed),
  "application_url": string (best apply URL; use page URL if unknown),
  "inferred_custom_questions": { "prompt": string }[],
  "requires_cover_letter": boolean,
  "confidence": number 0-1
}`;

  const raw = await completeJson(
    system,
    `Page URL: ${hints.pageUrl}\nOG title: ${hints.ogTitle ?? ''}\nOG description: ${hints.ogDescription ?? ''}\nJSON-LD hints:\n${(hints.jsonLd ?? '').slice(0, 8000)}\n\nMain text:\n${mainText.slice(0, 40_000)}`
  );
  try {
    const o = JSON.parse(stripJsonFences(raw)) as ExtractedListingNormalized;
    const confidence = Math.max(0, Math.min(1, Number(o.confidence) || 0));
    return {
      title: typeof o.title === 'string' ? o.title : 'Role',
      company: o.company === null ? null : typeof o.company === 'string' ? o.company : null,
      location: typeof o.location === 'string' ? o.location : '',
      description: typeof o.description === 'string' ? o.description : mainText.slice(0, 8000),
      application_url:
        typeof o.application_url === 'string' && o.application_url.trim()
          ? o.application_url.trim()
          : hints.pageUrl,
      inferred_custom_questions: Array.isArray(o.inferred_custom_questions)
        ? o.inferred_custom_questions.map((q) => ({ prompt: String(q?.prompt ?? '') }))
        : [],
      requires_cover_letter: Boolean(o.requires_cover_letter),
      confidence,
    };
  } catch (err) {
    logger.error({ err, requestId }, 'claude_extract_listing_parse_failed');
    return {
      title: hints.ogTitle || 'Job posting',
      company: null,
      location: '',
      description: mainText.slice(0, 8000),
      application_url: hints.pageUrl,
      inferred_custom_questions: [],
      requires_cover_letter: false,
      confidence: 0.1,
    };
  }
}

export interface VisionFormAction {
  selector: string;
  action: 'fill' | 'click' | 'select' | 'upload';
  value?: string;
}

/** Phase 9.5 — whitelist-friendly action plan from screenshot + DOM summary. */
export async function claudePlanFormActions(
  domSummary: string,
  requestId: string
): Promise<VisionFormAction[]> {
  const system = `You output a JSON array only of actions to complete a job application form.
Allowed actions: "fill", "click", "select", "upload". Each item: { "selector": string (CSS), "action": string, "value": string optional }.
Use conservative selectors (id, name, aria-label). Max 12 steps.`;

  const raw = await completeJson(
    system,
    `DOM summary:\n${domSummary.slice(0, 24_000)}`
  );
  try {
    const parsed = JSON.parse(stripJsonFences(raw));
    if (!Array.isArray(parsed)) return [];
    const out: VisionFormAction[] = [];
    for (const row of parsed.slice(0, 12)) {
      const action = row?.action as string;
      if (!['fill', 'click', 'select', 'upload'].includes(action)) continue;
      const selector = typeof row?.selector === 'string' ? row.selector : '';
      if (!selector) continue;
      out.push({
        selector,
        action: action as VisionFormAction['action'],
        value: typeof row?.value === 'string' ? row.value : undefined,
      });
    }
    return out;
  } catch (err) {
    logger.error({ err, requestId }, 'claude_form_plan_parse_failed');
    return [];
  }
}
