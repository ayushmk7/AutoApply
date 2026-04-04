import { randomUUID } from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../lib/config.js';
import { signDemoToken } from '../lib/demoJwt.js';
import { getFirestore } from '../lib/firebase.js';
import { logger } from '../lib/logger.js';
import { requireFirebaseAuth } from '../middleware/auth.js';
import { ensureUserDocument } from '../services/userDocument.js';

const registerBodySchema = z.object({
  email: z.string().email().optional(),
});

export const authRouter = Router();

const skipRateLimiter = rateLimit({
  windowMs: config.skipAuthRateLimitWindowMs,
  max: config.nodeEnv === 'production' ? config.skipAuthRateLimitMaxProd : config.skipAuthRateLimitMaxDev,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many demo sessions, try again later', code: 'RATE_LIMITED' },
});

authRouter.post('/register', requireFirebaseAuth, async (req, res, next) => {
  try {
    const parsed = registerBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const uid = req.uid!;
    const emailFromToken = req.email?.trim() || '';
    const bodyEmail = parsed.data.email?.trim();

    if (bodyEmail && emailFromToken && bodyEmail.toLowerCase() !== emailFromToken.toLowerCase()) {
      res.status(400).json({
        error: 'Email does not match authenticated user',
        code: 'EMAIL_MISMATCH',
      });
      return;
    }

    const email = bodyEmail || emailFromToken;
    if (!email) {
      logger.warn({ requestId: req.requestId, uid }, 'register_missing_email');
    }

    const db = getFirestore();
    const { created } = await ensureUserDocument(db, uid, email, req.requestId);
    res.status(200).json({ uid, created });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not initialized')) {
      res.status(503).json({
        error: 'Database unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
      return;
    }
    next(err);
  }
});

authRouter.post('/skip', skipRateLimiter, async (req, res, next) => {
  if (config.nodeEnv === 'production' && !config.enableDemoSkip) {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    return;
  }

  try {
    const demoUid = `demo_${randomUUID()}`;
    const token = await signDemoToken(demoUid);

    try {
      const db = getFirestore();
      await ensureUserDocument(db, demoUid, '', req.requestId, { isDemo: true });
    } catch {
      logger.warn({ requestId: req.requestId, demoUid }, 'demo_skip_firestore_unavailable');
    }

    res.status(200).json({ demo_uid: demoUid, token });
  } catch (err) {
    next(err);
  }
});
