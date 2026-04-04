import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getResumeTemplatePathForPreference } from '../lib/templatePaths.js';
import { listingDocumentRef, userApplicationRef, userDocumentRef } from '../lib/firestorePaths.js';
import { config } from '../lib/config.js';
import { getQuotaRedis } from '../lib/redisQuota.js';
import { logger } from '../lib/logger.js';
import {
  claudeAnalyzeJob,
  claudeAtsScore,
  claudeFixLatexFromLog,
  claudeGenerateCoverLetter,
  claudeGenerateCustomAnswers,
  claudeGenerateResumeLatex,
  claudeValidateResumeAgainstCv,
} from './claudeApply.js';
import { compileLatexToPdf } from './compileLatex.js';
import { emitUserFeed, type FeedEmitContext } from './feedEmit.js';
import { gcsCoverLetterPath, gcsResumePdfPath, getBucket, uploadBufferToObject } from './gcs.js';
import { escapeLatexFragment } from './latexEscape.js';
import { pdfBufferToPlainText } from './pdfPlainText.js';
import { submitApplicationViaPlaywright } from './playwrightSubmit.js';
import { countApplicationsStartedUtcDay } from './dailyApplyQuota.js';
import { effectiveDailyApplicationCap } from './userApplyQuota.js';
import { tryConsumeAtsDomainHourlySlot } from './distributedRateLimits.js';
import { appendApplicationRowIfEnabled } from './googleSheetsSync.js';
import { detectAtsTypeFromUrl } from './atsDetect.js';
import type { ListingDocument } from '../types/listing.js';
import type { ProfileCv, ProfileDocument, ProfileQuestionnaire } from '../types/profile.js';

const PLACEHOLDER = '{{AUTOAPPLY_RESUME_BODY}}';

const emptyQuestionnaire = (): ProfileQuestionnaire => ({
  work_auth: {
    authorized: false,
    sponsorship_needed: false,
    citizenship: '',
    visa_type: '',
  },
  demographics: { gender: '', ethnicity: '', veteran: '', disability: '' },
  education_meta: { graduation_date: '', student_status: false },
  availability: { start_date: '', terms: [], locations: [], relocate: false, remote_ok: false },
  defaults: { hear_about: '', salary: '' },
  essays: {
    technical_project: '',
    teamwork: '',
    challenge: '',
    motivation: '',
  },
});

const emptyCv = (): ProfileCv => ({
  education: [],
  experience: [],
  projects: [],
  skills: { languages: [], frameworks: [], tools: [], other: [] },
  extracurriculars: [],
  awards: [],
  publications: [],
  certifications: [],
});

function coerceProfile(uid: string, raw: Record<string, unknown> | undefined): ProfileDocument {
  const q = (raw?.questionnaire as ProfileQuestionnaire | undefined) ?? emptyQuestionnaire();
  const cv = (raw?.cv as ProfileCv | undefined) ?? emptyCv();
  return {
    uid: String(raw?.uid ?? uid),
    email: String(raw?.email ?? ''),
    cv,
    questionnaire: q,
    preferences: (raw?.preferences as ProfileDocument['preferences']) ?? {
      resume_template: 'jakes',
      auto_apply_threshold: config.defaultAutoApplyThreshold,
      daily_limit: config.defaultProfileDailyLimit,
      sheets_enabled: false,
      sheets_id: '',
      calendar_connected: false,
      linkedin_connections: [],
    },
    agentmail_address: String(raw?.agentmail_address ?? ''),
    created_at: raw?.created_at,
    updated_at: raw?.updated_at,
  };
}

function coverLetterTex(body: string): string {
  const escaped = escapeLatexFragment(body).replace(/\n/g, '\\\\\n');
  return `\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{geometry}
\\geometry{margin=1in}
\\begin{document}
\\noindent
${escaped}
\\end{document}
`;
}

export interface ApplyPipelineInput {
  db: Firestore;
  uid: string;
  applicationId: string;
  listingId: string;
  requestId: string;
  forceManualSubmit?: boolean;
}

/**
 * Phases 8–9 — shared by `apply` and `apply_from_pasted_url` (Phase 10.6).
 */
export async function runApplyPipeline(input: ApplyPipelineInput): Promise<void> {
  const { db, uid, applicationId, listingId, requestId } = input;
  const appRef = userApplicationRef(db, uid, applicationId);
  const listingRef = listingDocumentRef(db, listingId);
  const userRef = userDocumentRef(db, uid);
  let feedCtx: FeedEmitContext = {};

  const failManual = async (reason: string, code?: string, nextStep?: string) => {
    await appRef.set(
      {
        status: 'manual_needed',
        manual_reason: reason,
        response_type: code ?? 'MANUAL_COMPLETION_REQUIRED',
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await emitUserFeed(
      uid,
      {
        action: 'manual_needed',
        application_id: applicationId,
        listing_id: listingId,
        detail: reason,
        code,
        next_step: nextStep,
      },
      requestId,
      feedCtx
    );
  };

  try {
    await appRef.set({ status: 'applying', updated_at: FieldValue.serverTimestamp() }, { merge: true });

    const [listSnap, userSnap, appSnap] = await Promise.all([
      listingRef.get(),
      userRef.get(),
      appRef.get(),
    ]);

    if (!listSnap.exists || !appSnap.exists) {
      await failManual('Application or listing was removed.', 'NOT_FOUND');
      return;
    }

    const listing = { id: listingId, ...(listSnap.data() as object) } as ListingDocument;
    feedCtx = {
      company: listing.company ?? '',
      role: listing.role ?? '',
    };
    const profile = coerceProfile(uid, userSnap.data() as Record<string, unknown> | undefined);
    const isDemo = Boolean((userSnap.data() as { is_demo?: boolean } | undefined)?.is_demo);

    const cvDoc = profile.cv;
    const hasCvContent =
      (cvDoc.experience?.length ?? 0) > 0 ||
      (cvDoc.education?.length ?? 0) > 0 ||
      (cvDoc.projects?.length ?? 0) > 0;
    if (!hasCvContent) {
      await failManual('Complete your CV in profile before applying.', 'MANUAL_COMPLETION_REQUIRED');
      return;
    }

    const jd = (listing.description || '').trim();
    if (!jd) {
      await failManual('Job description is missing for this listing.', 'EXTRACTION_LOW_CONFIDENCE', 'paste_jd');
      return;
    }

    const effectiveDailyCap = effectiveDailyApplicationCap(profile.preferences?.daily_limit, isDemo);
    if (!getQuotaRedis()) {
      const startedToday = await countApplicationsStartedUtcDay(db, uid);
      if (startedToday >= effectiveDailyCap) {
        await failManual('Daily application limit reached.', 'RATE_LIMITED');
        return;
      }
    }

    const atsCap = await tryConsumeAtsDomainHourlySlot(listing.url, isDemo, requestId);
    if (!atsCap.ok) {
      await failManual(
        `Too many applications to this employer domain this hour (${atsCap.domain}).`,
        'RATE_LIMITED'
      );
      return;
    }

    if (!config.anthropicApiKey) {
      await failManual('Resume generation is unavailable (missing ANTHROPIC_API_KEY).', 'SERVICE_UNAVAILABLE');
      return;
    }

    if (input.forceManualSubmit) {
      await failManual('Manual submission requested by user.', 'MANUAL_COMPLETION_REQUIRED');
      return;
    }

    if (detectAtsTypeFromUrl(listing.url) === 'workday') {
      await failManual('Workday portals require manual submission per product policy.', 'MANUAL_COMPLETION_REQUIRED');
      return;
    }

    await emitUserFeed(
      uid,
      { action: 'generating_resume', application_id: applicationId, listing_id: listingId },
      requestId,
      feedCtx
    );

    const analysis = await claudeAnalyzeJob(jd, requestId);
    await appRef.set(
      {
        needs_manual_review: analysis.needs_manual_review,
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    let feedback: string | undefined;
    let latexBody = await claudeGenerateResumeLatex(
      profile.cv,
      analysis,
      listing.role,
      listing.company || 'Company',
      undefined,
      requestId
    );

    const validation = await claudeValidateResumeAgainstCv(profile.cv, latexBody, requestId);
    if (!validation.ok) {
      feedback = validation.issues.join('; ');
      latexBody = await claudeGenerateResumeLatex(
        profile.cv,
        analysis,
        listing.role,
        listing.company || 'Company',
        feedback,
        requestId
      );
    }

    const templatePath = getResumeTemplatePathForPreference(profile.preferences?.resume_template);
    const template = await readFile(templatePath, 'utf8');
    if (!template.includes(PLACEHOLDER)) {
      throw new Error('resume_template_missing_placeholder');
    }

    let fullTex = template.replace(PLACEHOLDER, latexBody);

    await emitUserFeed(
      uid,
      { action: 'compiling_pdf', application_id: applicationId, listing_id: listingId },
      requestId,
      feedCtx
    );

    let compiled = await compileLatexToPdf(fullTex, requestId);
    if (!compiled.ok && compiled.log) {
      const fixed = await claudeFixLatexFromLog(fullTex, compiled.log, requestId);
      fullTex = fixed;
      compiled = await compileLatexToPdf(fullTex, requestId);
    }

    if (!compiled.ok || !compiled.pdf) {
      const logPath = `debug/${uid}/${applicationId}/compile.log`;
      if (compiled.log) {
        await uploadBufferToObject(logPath, Buffer.from(compiled.log, 'utf8'), 'text/plain').catch(() => {});
      }
      await failManual('Resume PDF could not be compiled; see logs stored for support.', 'MANUAL_COMPLETION_REQUIRED');
      return;
    }

    let pdfBuffer = compiled.pdf;
    let plain = await pdfBufferToPlainText(pdfBuffer);

    await emitUserFeed(
      uid,
      { action: 'ats_scoring', application_id: applicationId, listing_id: listingId },
      requestId,
      feedCtx
    );

    let revisionLoops = 0;
    let ats = await claudeAtsScore(plain, jd, requestId);
    while (
      ats.score < config.atsTargetScorePercent &&
      revisionLoops < config.atsRevisionMaxLoops
    ) {
      revisionLoops++;
      const hint = `${ats.suggestions}\nMissing: ${ats.missing.join(', ')}`;
      latexBody = await claudeGenerateResumeLatex(
        profile.cv,
        analysis,
        listing.role,
        listing.company || 'Company',
        hint,
        requestId
      );
      fullTex = template.replace(PLACEHOLDER, latexBody);
      const nextCompile = await compileLatexToPdf(fullTex, requestId);
      if (!nextCompile.ok || !nextCompile.pdf) break;
      pdfBuffer = nextCompile.pdf;
      plain = await pdfBufferToPlainText(pdfBuffer);
      ats = await claudeAtsScore(plain, jd, requestId);
    }

    const resumePath = gcsResumePdfPath(uid, applicationId);
    await uploadBufferToObject(resumePath, pdfBuffer, 'application/pdf');

    let coverPathGcs = '';
    const wantsCover = analysis.requires_cover_letter || listing.requires_cover_letter;
    if (wantsCover) {
      await emitUserFeed(
        uid,
        { action: 'generating_cover_letter', application_id: applicationId, listing_id: listingId },
        requestId,
        feedCtx
      );
      const letter = await claudeGenerateCoverLetter(jd, profile.cv, latexBody, requestId);
      const letterTex = coverLetterTex(letter);
      const letterPdf = await compileLatexToPdf(letterTex, requestId, { timeoutMs: 90_000 });
      if (letterPdf.ok && letterPdf.pdf) {
        coverPathGcs = gcsCoverLetterPath(uid, applicationId);
        await uploadBufferToObject(coverPathGcs, letterPdf.pdf, 'application/pdf');
      }
    }

    await emitUserFeed(
      uid,
      { action: 'generating_answers', application_id: applicationId, listing_id: listingId },
      requestId,
      feedCtx
    );
    const answers = await claudeGenerateCustomAnswers(
      analysis.custom_questions.map((q) => ({ id: q.id, prompt: q.prompt })),
      profile.questionnaire,
      profile.cv,
      requestId
    );

    await appRef.set(
      {
        ats_score: ats.score,
        ats_keywords_matched: ats.matched,
        ats_keywords_missing: ats.missing,
        resume_url: resumePath,
        cover_letter_url: coverPathGcs,
        custom_answers: answers,
        method: 'ats',
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const tmpDir = await mkdtemp(join(tmpdir(), 'applypl-'));
    const diskResume = join(tmpDir, 'resume.pdf');
    const diskCover = coverPathGcs ? join(tmpDir, 'cover.pdf') : undefined;
    try {
      await writeFile(diskResume, pdfBuffer);
      if (diskCover && coverPathGcs) {
        const [buf] = await getBucket().file(coverPathGcs).download();
        await writeFile(diskCover, buf);
      }

      await emitUserFeed(
        uid,
        { action: 'filling_form', application_id: applicationId, listing_id: listingId },
        requestId,
        feedCtx
      );
      const pw = await submitApplicationViaPlaywright({
        uid,
        applicationId,
        listingUrl: listing.url,
        profile,
        resumePath: diskResume,
        coverLetterPath: diskCover,
        customAnswers: answers,
        requestId,
        isDemo,
      });

      if (!pw.ok) {
        await appRef.set(
          {
            status: 'manual_needed',
            manual_reason: pw.manualReason ?? 'Playwright submission failed',
            submission_screenshot: `screenshots/${uid}/${applicationId}_postsubmit.png`,
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await emitUserFeed(
          uid,
          {
            action: 'manual_needed',
            application_id: applicationId,
            listing_id: listingId,
            detail: pw.manualReason,
            code: pw.code,
          },
          requestId,
          feedCtx
        );
        return;
      }

      await appRef.set(
        {
          status: 'applied',
          applied_date: FieldValue.serverTimestamp(),
          submission_screenshot: `screenshots/${uid}/${applicationId}_postsubmit.png`,
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await emitUserFeed(
        uid,
        { action: 'submitted', application_id: applicationId, listing_id: listingId },
        requestId,
        feedCtx
      );

      void appendApplicationRowIfEnabled(db, uid, applicationId, requestId).catch((err) => {
        logger.warn({ err, uid, applicationId }, 'sheets_append_after_apply_failed');
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, requestId, uid, applicationId }, 'apply_pipeline_failed');
    await failManual('Unexpected error during apply pipeline.', 'MANUAL_COMPLETION_REQUIRED');
  }
}
