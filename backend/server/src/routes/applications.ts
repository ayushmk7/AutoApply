import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../lib/config.js';
import { getFirestore } from '../lib/firebase.js';
import { HttpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import {
  applicationNotesBodySchema,
  applicationsListQuerySchema,
  getApplicationArtifactSignedUrl,
  getApplicationDetail,
  listApplications,
  manualDoneApplication,
  retryApplication,
  updateApplicationNotes,
} from '../services/applicationsApi.js';
import {
  confirmInterviewBodySchema,
  interviewNotesBodySchema,
  confirmInterview,
  getInterviewPrep,
  sendFollowUpEmail,
  sendThankYouEmail,
  submitInterviewNotes,
} from '../services/interviewApi.js';

export const applicationsRouter = Router();

function paramId(id: string | string[] | undefined): string {
  if (Array.isArray(id)) return (id[0] ?? '').trim();
  return (id ?? '').trim();
}

const retryLimiter = rateLimit({
  windowMs: config.applicationRetryRateLimitWindowMs,
  max: config.applicationRetryRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = req.uid ?? 'anon';
    const aid = paramId(req.params.id);
    return `${uid}:${aid}`;
  },
});

/** Phase 11.1 */
applicationsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const parsed = applicationsListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(
        new HttpError(400, 'Invalid query parameters.', 'VALIDATION_ERROR', parsed.error.flatten())
      );
      return;
    }
    const db = getFirestore();
    const result = await listApplications(db, uid, parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Phase 11.2 */
applicationsRouter.get('/:id/resume', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const signed = await getApplicationArtifactSignedUrl(db, uid, applicationId, 'resume');
    res.json({ url: signed.url, expires_at: signed.expires_at });
  } catch (err) {
    next(err);
  }
});

applicationsRouter.get('/:id/cover-letter', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const signed = await getApplicationArtifactSignedUrl(db, uid, applicationId, 'cover-letter');
    res.json({ url: signed.url, expires_at: signed.expires_at });
  } catch (err) {
    next(err);
  }
});

applicationsRouter.get('/:id/screenshot', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const signed = await getApplicationArtifactSignedUrl(db, uid, applicationId, 'screenshot');
    res.json({ url: signed.url, expires_at: signed.expires_at });
  } catch (err) {
    next(err);
  }
});

/** Phase 11.3 */
applicationsRouter.post('/:id/retry', requireAuth, retryLimiter, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const result = await retryApplication(db, uid, applicationId, req.requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Phase 11.4 */
applicationsRouter.post('/:id/manual-done', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const result = await manualDoneApplication(db, uid, applicationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Phase 11.5 */
applicationsRouter.put('/:id/notes', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const parsed = applicationNotesBodySchema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new HttpError(400, 'Invalid request body.', 'VALIDATION_ERROR', parsed.error.flatten())
      );
      return;
    }
    const db = getFirestore();
    const result = await updateApplicationNotes(db, uid, applicationId, parsed.data.notes);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Phase 12 */
applicationsRouter.post('/:id/confirm-interview', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const parsed = confirmInterviewBodySchema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new HttpError(400, 'Invalid request body.', 'VALIDATION_ERROR', parsed.error.flatten())
      );
      return;
    }
    const db = getFirestore();
    const result = await confirmInterview(
      db,
      uid,
      applicationId,
      parsed.data.selected_time,
      req.requestId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

applicationsRouter.get('/:id/prep', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const result = await getInterviewPrep(db, uid, applicationId, req.requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

applicationsRouter.post('/:id/interview-notes', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const parsed = interviewNotesBodySchema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new HttpError(400, 'Invalid request body.', 'VALIDATION_ERROR', parsed.error.flatten())
      );
      return;
    }
    const db = getFirestore();
    const result = await submitInterviewNotes(db, uid, applicationId, parsed.data.notes);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

applicationsRouter.post('/:id/send-thankyou', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const result = await sendThankYouEmail(db, uid, applicationId, req.requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

applicationsRouter.post('/:id/send-followup', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const result = await sendFollowUpEmail(db, uid, applicationId, req.requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Phase 11.1 detail — register last */
applicationsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const applicationId = paramId(req.params.id);
    if (!applicationId) {
      next(new HttpError(400, 'Invalid application id.', 'VALIDATION_ERROR'));
      return;
    }
    const db = getFirestore();
    const result = await getApplicationDetail(db, uid, applicationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
