import { Router } from 'express';
import { getFirestore } from '../lib/firebase.js';
import { HttpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import { feedListQuerySchema, listUserFeedPage } from '../services/feedApi.js';

export const feedRouter = Router();

/** Phase 13.1 */
feedRouter.get('/feed', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const parsed = feedListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(
        new HttpError(400, 'Invalid query parameters.', 'VALIDATION_ERROR', parsed.error.flatten())
      );
      return;
    }
    const db = getFirestore();
    const result = await listUserFeedPage(db, uid, parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
