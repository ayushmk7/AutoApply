import { readFile } from 'node:fs/promises';
import { config } from '../lib/config.js';
import { detectAtsTypeFromUrl } from './atsDetect.js';
import { gcsScreenshotPath, uploadBufferToObject } from './gcs.js';
import { logger } from '../lib/logger.js';
import { defaultCaptchaSolver, selectAdapter } from '../playwright/atsAdapter.js';
import { withApplicationContext } from '../playwright/manager.js';
import type { ProfileDocument } from '../types/profile.js';

export interface PlaywrightSubmitOptions {
  uid: string;
  applicationId: string;
  listingUrl: string;
  profile: ProfileDocument;
  resumePath: string;
  coverLetterPath?: string;
  customAnswers: Record<string, string>;
  requestId: string;
  /** Phase 16 — lower Playwright cluster cap for demo sessions. */
  isDemo?: boolean;
}

/**
 * Phase 9 — ATS adapters, captcha, screenshots to GCS (9.7).
 */
export async function submitApplicationViaPlaywright(
  opts: PlaywrightSubmitOptions
): Promise<{ ok: boolean; manualReason?: string; code?: string }> {
  const ats = detectAtsTypeFromUrl(opts.listingUrl);
  if (ats === 'workday') {
    return { ok: false, manualReason: 'Workday applications require manual submission.', code: 'MANUAL_COMPLETION_REQUIRED' };
  }

  const adapter = selectAdapter(opts.listingUrl, opts.requestId);
  const solver = defaultCaptchaSolver(opts.requestId);

  try {
    return await withApplicationContext(async (ctx) => {
      const page = await ctx.newPage();
      await page.goto(opts.listingUrl, {
        waitUntil: 'domcontentloaded',
        timeout: config.playwrightPageGotoTimeoutMs,
      });

      const preShot = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: false });
      await uploadBufferToObject(
        gcsScreenshotPath(opts.uid, opts.applicationId, 'prefill'),
        Buffer.from(preShot),
        'image/jpeg'
      );

      const fill = await adapter.fill(page, {
        profile: opts.profile,
        resumePath: opts.resumePath,
        coverLetterPath: opts.coverLetterPath,
        customAnswers: opts.customAnswers,
      });

      const captchaOk = await adapter.handleCaptcha(page, solver);
      if (!captchaOk) {
        const shot = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: false });
        await uploadBufferToObject(
          gcsScreenshotPath(opts.uid, opts.applicationId, 'captcha_failed'),
          Buffer.from(shot),
          'image/jpeg'
        );
        return {
          ok: false,
          manualReason: 'CAPTCHA could not be solved or balance timed out.',
          code: 'MANUAL_COMPLETION_REQUIRED',
        };
      }

      if (fill.unfilledFields.length > 0) {
        const htmlSnippet = await page.content();
        const snippetPath = `debug/${opts.uid}/${opts.applicationId}/failure.html`;
        await uploadBufferToObject(
          snippetPath,
          Buffer.from(htmlSnippet.slice(0, 200_000), 'utf8'),
          'text/html'
        );
      }

      const postFill = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: false });
      await uploadBufferToObject(
        gcsScreenshotPath(opts.uid, opts.applicationId, 'postfill'),
        Buffer.from(postFill),
        'image/jpeg'
      );

      const submit = await adapter.submit(page);

      const postSubmit = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: true });
      await uploadBufferToObject(
        gcsScreenshotPath(opts.uid, opts.applicationId, 'postsubmit'),
        Buffer.from(postSubmit),
        'image/jpeg'
      );

      if (!submit.success) {
        return {
          ok: false,
          manualReason: submit.error || 'Submit step did not complete.',
          code: 'MANUAL_COMPLETION_REQUIRED',
        };
      }

      return { ok: true };
    }, { isDemo: opts.isDemo, requestId: opts.requestId });
  } catch (err) {
    logger.error({ err, requestId: opts.requestId }, 'playwright_submit_failed');
    return {
      ok: false,
      manualReason: String(err),
      code: 'MANUAL_COMPLETION_REQUIRED',
    };
  }
}

/** Load small file paths for optional cover letter upload. */
export async function pathIfExists(p?: string): Promise<string | undefined> {
  if (!p) return undefined;
  try {
    await readFile(p);
    return p;
  } catch {
    return undefined;
  }
}
