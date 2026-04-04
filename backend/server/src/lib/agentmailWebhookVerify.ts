import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { config } from './config.js';
import { logger } from './logger.js';

const MAX_SKEW_SEC = 300;

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a.replace(/^sha256=/i, '').trim(), 'hex');
    const bb = Buffer.from(b.trim(), 'hex');
    if (ab.length !== bb.length || ab.length === 0) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Phase 14.2 — HMAC / shared secret verification (`docs/06_BACKEND_IMPLEMENTATION_STEPS.md`).
 */
export function verifyAgentmailWebhookSignature(req: Request, rawBody: Buffer | undefined): boolean {
  const secret = config.agentmailWebhookSecret;
  if (!secret) {
    if (config.nodeEnv === 'production') {
      return false;
    }
    logger.warn('agentmail_webhook_verify_skipped_no_secret_dev');
    return true;
  }

  const shared = req.get('x-webhook-secret')?.trim();
  if (shared && shared === secret) {
    return true;
  }

  if (!rawBody || rawBody.length === 0) {
    return false;
  }

  const tsRaw =
    req.get('x-agentmail-timestamp')?.trim() ??
    req.get('x-webhook-timestamp')?.trim() ??
    req.get('x-svix-timestamp')?.trim();
  if (tsRaw) {
    const ts = Number.parseInt(tsRaw, 10);
    if (Number.isFinite(ts)) {
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - ts) > MAX_SKEW_SEC) {
        logger.info({ now, ts }, 'agentmail_webhook_timestamp_out_of_tolerance');
        return false;
      }
    }
  }

  const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');

  const candidates = [
    req.get('x-agentmail-signature'),
    req.get('x-webhook-signature'),
    req.get('x-hub-signature-256'),
    req.get('x-svix-signature'),
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    const trimmed = c.trim();
    if (trimmed.startsWith('sha256=')) {
      const hexPart = trimmed.slice('sha256='.length).trim();
      if (timingSafeEqualHex(hexPart, expectedHex)) return true;
    } else if (timingSafeEqualHex(trimmed, expectedHex)) {
      return true;
    }
  }

  return false;
}
