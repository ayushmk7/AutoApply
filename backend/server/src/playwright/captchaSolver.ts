import { setTimeout as delay } from 'node:timers/promises';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

/**
 * Phase 9.6 — 2Captcha reCAPTCHA v2 (PRD §4.4).
 */
export async function solveRecaptchaV2Token(
  siteKey: string,
  pageUrl: string,
  requestId: string
): Promise<string | null> {
  const apiKey = config.captcha2CaptchaKey;
  if (!apiKey) {
    logger.warn({ requestId }, 'captcha_no_api_key');
    return null;
  }

  const inParams = new URLSearchParams({
    key: apiKey,
    method: 'userrecaptcha',
    googlekey: siteKey,
    pageurl: pageUrl,
  });

  let inText: string;
  try {
    const res = await fetch(`https://2captcha.com/in.php?${inParams.toString()}`);
    inText = await res.text();
  } catch (err) {
    logger.warn({ err, requestId }, 'captcha_submit_failed');
    return null;
  }

  if (!inText.startsWith('OK|')) {
    logger.warn({ requestId, inText }, 'captcha_submit_rejected');
    return null;
  }
  const taskId = inText.slice(3);

  for (let i = 0; i < 48; i++) {
    await delay(5000);
    try {
      const poll = await fetch(
        `https://2captcha.com/res.php?key=${encodeURIComponent(apiKey)}&action=get&id=${encodeURIComponent(taskId)}&json=1`
      );
      const pj = (await poll.json()) as { status?: number; request?: string };
      if (pj.status === 1 && typeof pj.request === 'string') {
        return pj.request;
      }
      if (pj.request && pj.request !== 'CAPCHA_NOT_READY') {
        logger.warn({ requestId, request: pj.request }, 'captcha_poll_error');
        return null;
      }
    } catch (err) {
      logger.warn({ err, requestId }, 'captcha_poll_failed');
      return null;
    }
  }

  logger.warn({ requestId }, 'captcha_timeout');
  return null;
}
