import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { verifyAgentmailWebhookSignature } from '../lib/agentmailWebhookVerify.js';
import { config } from '../lib/config.js';
import { agentmailDedupeRef } from '../lib/firestorePaths.js';
import { getFirestore } from '../lib/firebase.js';
import { logger } from '../lib/logger.js';
import {
  findUidByAgentmailRecipient,
  matchApplicationForInboundEmail,
  normalizeAgentmailPayload,
} from '../services/agentmailInbound.js';
import { executeProcessResponseWorkflow } from '../queues/processResponseProcessor.js';
import { enqueueProcessResponseJob } from '../queues/producers.js';
import { HttpError } from '../lib/httpError.js';
import { createHash } from 'crypto';

export const webhooksRouter = Router();

const agentmailLimiter = rateLimit({
  windowMs: config.agentmailWebhookRateLimitWindowMs,
  max: config.agentmailWebhookRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

function dedupeKeyFromPayload(
  messageId: string | undefined,
  from: string,
  to: string,
  subject: string,
  body: string
): string {
  if (messageId?.trim()) {
    return createHash('sha256').update(messageId.trim()).digest('hex').slice(0, 64);
  }
  return createHash('sha256')
    .update(`${from}|${to}|${subject}|${body.slice(0, 2000)}`)
    .digest('hex')
    .slice(0, 64);
}

webhooksRouter.post('/agentmail', agentmailLimiter, async (req, res, next) => {
  try {
    const rawBody = req.rawBody;
    if (!verifyAgentmailWebhookSignature(req, rawBody)) {
      res.status(401).json({ error: 'Invalid webhook signature', code: 'WEBHOOK_UNAUTHORIZED' });
      return;
    }

    const parsed = normalizeAgentmailPayload(req.body);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid webhook payload', code: 'VALIDATION_ERROR' });
      return;
    }

    const db = getFirestore();
    const uid = await findUidByAgentmailRecipient(db, parsed.to);
    if (!uid) {
      logger.info({ to: parsed.to }, 'agentmail_webhook_unknown_recipient');
      res.status(200).json({ ok: true, ignored: true, reason: 'unknown_recipient' });
      return;
    }

    const applicationId = await matchApplicationForInboundEmail(db, uid, parsed.from);
    const dedupeKey = dedupeKeyFromPayload(parsed.messageId, parsed.from, parsed.to, parsed.subject, parsed.body);

    const isNew = await claimDedupe(db, dedupeKey, uid);
    if (!isNew) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    const jobData = {
      uid,
      applicationId,
      email: {
        dedupeKey,
        from: parsed.from,
        to: parsed.to,
        subject: parsed.subject,
        body: parsed.body,
      },
    };

    const requestId = req.requestId ?? 'webhook-agentmail';

    if (config.redisUrl) {
      await enqueueProcessResponseJob(
        { ...jobData, requestId },
        requestId
      );
    } else {
      logger.warn({ requestId }, 'process_response_inline_no_redis');
      await executeProcessResponseWorkflow({ ...jobData, requestId });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function claimDedupe(db: Firestore, dedupeKey: string, uid: string): Promise<boolean> {
  const ref = agentmailDedupeRef(db, dedupeKey);
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (snap.exists) {
        return false;
      }
      t.set(ref, {
        uid,
        created_at: FieldValue.serverTimestamp(),
      });
      return true;
    });
  } catch (err) {
    logger.warn({ err, dedupeKey }, 'agentmail_dedupe_transaction_failed');
    throw new HttpError(503, 'Dedupe storage failed.', 'SERVICE_UNAVAILABLE');
  }
}
