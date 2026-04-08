import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getFirestore } from '../lib/firebase.js';
import { COLLECTION_WAITLIST } from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';

const waitlistBodySchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
});

const waitlistRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});

export const waitlistRouter = Router();

waitlistRouter.post('/', waitlistRateLimiter, async (req, res, next) => {
  try {
    const parsed = waitlistBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { email, name } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const db = getFirestore();
    const docRef = db.collection(COLLECTION_WAITLIST).doc(
      Buffer.from(normalizedEmail).toString('base64url')
    );

    const existing = await docRef.get();
    if (existing.exists) {
      res.status(200).json({ joined: false, message: 'Already on the waitlist' });
      return;
    }

    await docRef.set({
      email: normalizedEmail,
      name: name?.trim() ?? null,
      createdAt: new Date().toISOString(),
      requestId: req.requestId ?? null,
    });

    logger.info({ requestId: req.requestId, email: normalizedEmail }, 'waitlist_joined');
    res.status(201).json({ joined: true, message: 'Added to waitlist' });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not initialized')) {
      res.status(503).json({ error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' });
      return;
    }
    next(err);
  }
});
