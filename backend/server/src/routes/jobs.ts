import { Router } from 'express';
import { getFirestore } from '../lib/firebase.js';
import { HttpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import {
  approveJobForUser,
  getJobDetailForUser,
  getJobsStats,
  jobsListQuerySchema,
  listJobsForUser,
  skipJobForUser,
} from '../services/jobsApi.js';
import {
  fromUrlBodySchema,
  getFromUrlApplicationStatus,
  startApplyFromUrl,
} from '../services/jobsFromUrlApi.js';

export const jobsRouter = Router();

function paramId(id: string | string[] | undefined): string {
  if (Array.isArray(id)) return (id[0] ?? '').trim();
  return (id ?? '').trim();
}

/** Phase 7.4 — register before `/:id` */
jobsRouter.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const db = getFirestore();
    const stats = await getJobsStats(db);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/** Phase 10.1 — register before `/:id` routes */
jobsRouter.post('/from-url', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const parsed = fromUrlBodySchema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new HttpError(400, 'Invalid request body.', 'VALIDATION_ERROR', parsed.error.flatten())
      );
      return;
    }
    const db = getFirestore();
    const result = await startApplyFromUrl(db, uid, parsed.data, req.requestId);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

/** Phase 10.1 — polling when WebSocket disconnected */
jobsRouter.get('/from-url/:application_id/status', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.application_id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const payload = await getFromUrlApplicationStatus(db, uid, applicationId);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

/** Phase 7.1 */
jobsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const parsed = jobsListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(
        new HttpError(400, 'Invalid query parameters.', 'VALIDATION_ERROR', parsed.error.flatten())
      );
      return;
    }
    const db = getFirestore();
    const result = await listJobsForUser(db, uid, parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Phase 7.3 */
jobsRouter.post('/:id/approve', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const listingId = paramId(req.params.id);
    if (!listingId) {
      next(new HttpError(400, 'Invalid listing id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const result = await approveJobForUser(db, uid, listingId, req.requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

jobsRouter.post('/:id/skip', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const listingId = paramId(req.params.id);
    if (!listingId) {
      next(new HttpError(400, 'Invalid listing id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    await skipJobForUser(db, uid, listingId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** Phase 7.2 */
jobsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const listingId = paramId(req.params.id);
    if (!listingId) {
      next(new HttpError(400, 'Invalid listing id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const row = await getJobDetailForUser(db, uid, listingId);
    res.json(row);
  } catch (err) {
    next(err);
  }
});
