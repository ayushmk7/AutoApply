import type { Page } from 'playwright';
import type { ProfileDocument } from '../types/profile.js';
import { solveRecaptchaV2Token } from './captchaSolver.js';

export interface ApplicationFillData {
  profile: ProfileDocument;
  resumePath: string;
  coverLetterPath?: string;
  customAnswers: Record<string, string>;
}

export interface FillResult {
  success: boolean;
  screenshot: string;
  unfilledFields: string[];
}

export interface SubmitResult {
  success: boolean;
  screenshot: string;
  error?: string;
}

export interface CaptchaSolver {
  solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<string | null>;
}

export function defaultCaptchaSolver(requestId: string): CaptchaSolver {
  return {
    solveRecaptchaV2: (siteKey, pageUrl) => solveRecaptchaV2Token(siteKey, pageUrl, requestId),
  };
}

/**
 * Technical PRD §5.3
 */
export interface ATSAdapter {
  detect(url: string): boolean;
  fill(page: Page, data: ApplicationFillData): Promise<FillResult>;
  submit(page: Page): Promise<SubmitResult>;
  handleCaptcha(page: Page, solver: CaptchaSolver): Promise<boolean>;
}

async function screenshotBase64(page: Page): Promise<string> {
  const buf = await page.screenshot({ fullPage: false, type: 'png' });
  return buf.toString('base64');
}

function sleepMs(min: number, max: number): Promise<void> {
  const ms = min + Math.floor(Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}

async function humanPause(): Promise<void> {
  await sleepMs(200, 800);
}

async function tryUploadResume(page: Page, resumePath: string): Promise<boolean> {
  const input = page.locator('input[type="file"]').first();
  if ((await input.count()) === 0) return false;
  try {
    await input.setInputFiles(resumePath);
    await humanPause();
    return true;
  } catch {
    return false;
  }
}

async function fillByLabel(page: Page, labelRe: RegExp, value: string): Promise<boolean> {
  const label = page.getByText(labelRe, { exact: false }).first();
  if ((await label.count()) === 0) return false;
  try {
    const control = page.getByLabel(labelRe, { exact: false }).first();
    if ((await control.count()) > 0) {
      await control.fill(value);
      await humanPause();
      return true;
    }
  } catch {
    /* continue */
  }
  return false;
}

async function fillCommonFields(page: Page, profile: ProfileDocument): Promise<string[]> {
  const missing: string[] = [];
  const q = profile.questionnaire;
  const first = (profile.email || '').split('@')[0] || 'Applicant';
  const tryFill = async (key: string, val: string, patterns: RegExp[]) => {
    if (!val) {
      missing.push(key);
      return;
    }
    for (const p of patterns) {
      if (await fillByLabel(page, p, val)) return;
    }
    missing.push(key);
  };

  await tryFill('email', profile.email, [/e-?mail/i]);
  await tryFill('name', first, [/first\s*name/i, /full\s*name/i, /name/i]);
  if (q?.availability?.locations?.length) {
    await tryFill('location', String(q.availability.locations[0]), [/location/i, /city/i]);
  }

  return missing;
}

export const greenhouseAdapter: ATSAdapter = {
  detect: (url) => /greenhouse\.io/i.test(url),
  async fill(page, data) {
    await humanPause();
    const uploaded = await tryUploadResume(page, data.resumePath);
    const unfilled: string[] = [];
    if (!uploaded) unfilled.push('resume_upload');
    const m = await fillCommonFields(page, data.profile);
    return {
      success: uploaded && m.length === 0,
      screenshot: await screenshotBase64(page),
      unfilledFields: [...unfilled, ...m],
    };
  },
  async submit(page) {
    await humanPause();
    const btn = page.getByRole('button', { name: /submit|apply/i }).first();
    try {
      if ((await btn.count()) > 0) {
        await btn.click();
        await sleepMs(2000, 3500);
        return { success: true, screenshot: await screenshotBase64(page) };
      }
    } catch (err) {
      return {
        success: false,
        screenshot: await screenshotBase64(page),
        error: String(err),
      };
    }
    return { success: false, screenshot: await screenshotBase64(page), error: 'no_submit' };
  },
  async handleCaptcha(page, solver) {
    const siteKey =
      (await page.locator('[data-sitekey]').first().getAttribute('data-sitekey')) ||
      (await page.locator('.g-recaptcha').first().getAttribute('data-sitekey'));
    if (!siteKey) return true;
    const token = await solver.solveRecaptchaV2(siteKey, page.url());
    if (!token) return false;
    await page.locator('textarea[name="g-recaptcha-response"]').evaluate((el, t) => {
      (el as HTMLTextAreaElement).value = t;
    }, token);
    return true;
  },
};

export const leverAdapter: ATSAdapter = {
  detect: (url) => /lever\.co/i.test(url),
  async fill(page, data) {
    await humanPause();
    const uploaded = await tryUploadResume(page, data.resumePath);
    const unfilled: string[] = [];
    if (!uploaded) unfilled.push('resume_upload');
    const m = await fillCommonFields(page, data.profile);
    return {
      success: uploaded && m.length === 0,
      screenshot: await screenshotBase64(page),
      unfilledFields: [...unfilled, ...m],
    };
  },
  async submit(page) {
    await humanPause();
    const btn = page.getByRole('button', { name: /submit application/i }).first();
    try {
      if ((await btn.count()) > 0) {
        await btn.click();
        await sleepMs(2000, 3500);
        return { success: true, screenshot: await screenshotBase64(page) };
      }
    } catch (err) {
      return {
        success: false,
        screenshot: await screenshotBase64(page),
        error: String(err),
      };
    }
    return { success: false, screenshot: await screenshotBase64(page), error: 'no_submit' };
  },
  async handleCaptcha(page, solver) {
    return greenhouseAdapter.handleCaptcha(page, solver);
  },
};

export const smartRecruitersAdapter: ATSAdapter = {
  detect: (url) => /smartrecruiters\.com/i.test(url),
  async fill(page, data) {
    await humanPause();
    const uploaded = await tryUploadResume(page, data.resumePath);
    const unfilled: string[] = [];
    if (!uploaded) unfilled.push('resume_upload');
    const m = await fillCommonFields(page, data.profile);
    return {
      success: uploaded,
      screenshot: await screenshotBase64(page),
      unfilledFields: [...unfilled, ...m],
    };
  },
  async submit(page) {
    return leverAdapter.submit(page);
  },
  async handleCaptcha(page, solver) {
    return greenhouseAdapter.handleCaptcha(page, solver);
  },
};

export const icimsAdapter: ATSAdapter = {
  detect: (url) => /icims\.com/i.test(url),
  async fill(page, data) {
    await humanPause();
    const uploaded = await tryUploadResume(page, data.resumePath);
    const unfilled: string[] = [];
    if (!uploaded) unfilled.push('resume_upload');
    const m = await fillCommonFields(page, data.profile);
    return {
      success: uploaded,
      screenshot: await screenshotBase64(page),
      unfilledFields: [...unfilled, ...m],
    };
  },
  async submit(page) {
    return leverAdapter.submit(page);
  },
  async handleCaptcha(page, solver) {
    return greenhouseAdapter.handleCaptcha(page, solver);
  },
};

export const workdayAdapter: ATSAdapter = {
  detect: (url) => /myworkdayjobs\.com|workday\.com/i.test(url),
  async fill(page) {
    return {
      success: false,
      screenshot: await screenshotBase64(page),
      unfilledFields: ['workday_manual'],
    };
  },
  async submit(page) {
    return {
      success: false,
      screenshot: await screenshotBase64(page),
      error: 'workday_manual',
    };
  },
  async handleCaptcha() {
    return false;
  },
};

function domSummary(page: import('playwright').Page): Promise<string> {
  return page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input,select,textarea,button'));
    return inputs
      .map((el) => {
        const tag = el.tagName.toLowerCase();
        const type = (el as HTMLInputElement).type || '';
        const name = el.getAttribute('name') || '';
        const id = el.getAttribute('id') || '';
        const aria = el.getAttribute('aria-label') || '';
        return `${tag} type=${type} name=${name} id=${id} aria=${aria}`;
      })
      .join('\n');
  });
}

export function genericVisionAdapter(requestId: string): ATSAdapter {
  return {
    detect: () => true,
    async fill(page, data) {
      const { claudePlanFormActions } = await import('../services/claudeApply.js');
      const summary = await domSummary(page);
      const plan = await claudePlanFormActions(summary, requestId);
      const unfilled: string[] = [];
      let steps = 0;
      for (const step of plan) {
        if (steps++ > 12) break;
        await humanPause();
        try {
          const loc = page.locator(step.selector).first();
          if ((await loc.count()) === 0) {
            unfilled.push(step.selector);
            continue;
          }
          if (step.action === 'fill' && step.value) {
            await loc.fill(step.value);
          } else if (step.action === 'click') {
            await loc.click();
          } else if (step.action === 'select' && step.value) {
            await loc.selectOption({ label: step.value });
          } else if (step.action === 'upload' && data.resumePath) {
            await loc.setInputFiles(data.resumePath);
          }
        } catch {
          unfilled.push(step.selector);
        }
      }
      const uploaded = await tryUploadResume(page, data.resumePath);
      if (!uploaded) unfilled.push('resume_upload');
      return {
        success: unfilled.length === 0,
        screenshot: await screenshotBase64(page),
        unfilledFields: unfilled,
      };
    },
    async submit(page) {
      return leverAdapter.submit(page);
    },
    async handleCaptcha(page, solver) {
      return greenhouseAdapter.handleCaptcha(page, solver);
    },
  };
}

export function selectAdapter(url: string, requestId: string): ATSAdapter {
  if (workdayAdapter.detect(url)) return workdayAdapter;
  if (greenhouseAdapter.detect(url)) return greenhouseAdapter;
  if (leverAdapter.detect(url)) return leverAdapter;
  if (smartRecruitersAdapter.detect(url)) return smartRecruitersAdapter;
  if (icimsAdapter.detect(url)) return icimsAdapter;
  return genericVisionAdapter(requestId);
}
