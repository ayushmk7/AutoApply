import { randomUUID } from 'crypto';
import express, { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { FieldValue } from 'firebase-admin/firestore';
import { config } from '../lib/config.js';
import { HttpError } from '../lib/httpError.js';
import { userDocumentRef } from '../lib/firestorePaths.js';
import { getFirestore } from '../lib/firebase.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { provisionAgentMailIfNeeded } from '../services/agentmailProvision.js';
import { claudeNormalizeLinkedInCompanies, claudeParseCvToJson } from '../services/claude.js';
import { extractTextFromDocx, extractTextFromPdf } from '../services/cvTextExtract.js';
import { gcsCvOriginalPath, getBucket } from '../services/gcs.js';
import { mergePreferences, mergeQuestionnaire } from '../services/profileMerge.js';
import {
  putPreferencesBodySchema,
  putProfileBodySchema,
  profileCvSchema,
  profileCvSchemaStrict,
} from '../services/profileSchemas.js';
import { isProfileReadyForAgentmail } from '../services/profileReadiness.js';
import { ensureUserDocument } from '../services/userDocument.js';
import type { ProfileDocument } from '../types/profile.js';

export const profileRouter = Router();

const CV_MAX_BYTES = 15 * 1024 * 1024;
const LINKEDIN_CSV_MAX_BYTES = 5 * 1024 * 1024;
const LINKEDIN_MAX_ROWS = 5000;

const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CV_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!ok) {
      cb(new Error('ONLY_PDF_OR_DOCX'));
      return;
    }
    cb(null, true);
  },
});

const uploadLinkedin = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LINKEDIN_CSV_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/octet-stream';
    if (!ok) {
      cb(new Error('ONLY_CSV'));
      return;
    }
    cb(null, true);
  },
});

function multerError(err: unknown, next: express.NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(new HttpError(400, 'File exceeds size limit.', 'FILE_TOO_LARGE'));
      return;
    }
  }
  if (err instanceof Error) {
    if (err.message === 'ONLY_PDF_OR_DOCX') {
      next(new HttpError(400, 'Only PDF or DOCX files are allowed.', 'VALIDATION_ERROR'));
      return;
    }
    if (err.message === 'ONLY_CSV') {
      next(new HttpError(400, 'Upload a CSV export (text/csv).', 'VALIDATION_ERROR'));
      return;
    }
  }
  next(err as Error);
}

profileRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const db = getFirestore();
    const uid = req.uid!;
    await ensureUserDocument(db, uid, req.email ?? '', req.requestId);
    const snap = await userDocumentRef(db, uid).get();
    const data = snap.data() as ProfileDocument;
    res.status(200).json(data);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not initialized')) {
      res.status(503).json({ error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' });
      return;
    }
    next(err);
  }
});

profileRouter.put('/', requireAuth, express.json({ limit: '1mb' }), async (req, res, next) => {
  try {
    const parsed = putProfileBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const uid = req.uid!;
    if (parsed.data.email?.trim()) {
      const bodyEmail = parsed.data.email.trim().toLowerCase();
      const tokenEmail = (req.email ?? '').trim().toLowerCase();
      if (req.authKind === 'firebase' && tokenEmail && bodyEmail !== tokenEmail) {
        res.status(400).json({
          error: 'Email does not match authenticated user',
          code: 'EMAIL_MISMATCH',
        });
        return;
      }
    }

    const db = getFirestore();
    await ensureUserDocument(db, uid, req.email ?? '', req.requestId);
    const ref = userDocumentRef(db, uid);
    const snap = await ref.get();
    const cur = snap.data() as ProfileDocument;

    const questionnaire = parsed.data.questionnaire
      ? mergeQuestionnaire(cur.questionnaire, parsed.data.questionnaire as never)
      : cur.questionnaire;

    const preferences = parsed.data.preferences
      ? mergePreferences(cur.preferences, parsed.data.preferences as never)
      : cur.preferences;

    const patch: Record<string, unknown> = {
      questionnaire,
      preferences,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (parsed.data.email?.trim()) {
      patch.email = parsed.data.email.trim();
    }

    await ref.update(patch);

    const nextSnap = await ref.get();
    const updated = nextSnap.data() as ProfileDocument;
    if (isProfileReadyForAgentmail(updated.cv, updated.questionnaire, updated.preferences)) {
      await provisionAgentMailIfNeeded(db, uid, req.requestId);
    }

    res.status(200).json(updated);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not initialized')) {
      res.status(503).json({ error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' });
      return;
    }
    next(err);
  }
});

profileRouter.post(
  '/cv',
  requireAuth,
  (req, res, next) => {
    uploadCv.single('file')(req, res, (err) => {
      if (err) multerError(err, next);
      else next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file?.buffer) {
        res.status(400).json({ error: 'Missing file field "file"', code: 'VALIDATION_ERROR' });
        return;
      }

      if (!config.anthropicApiKey) {
        res.status(503).json({
          error: 'CV parsing unavailable (missing ANTHROPIC_API_KEY)',
          code: 'SERVICE_UNAVAILABLE',
        });
        return;
      }

      const uid = req.uid!;
      const db = getFirestore();
      await ensureUserDocument(db, uid, req.email ?? '', req.requestId);

      const mime = req.file.mimetype;
      const ext = mime === 'application/pdf' ? 'pdf' : 'docx';
      const objectPath = gcsCvOriginalPath(uid, ext);
      const bucket = getBucket();

      await bucket.file(objectPath).save(req.file.buffer, {
        contentType: mime,
        resumable: false,
        metadata: { contentType: mime },
      });

      let plain: string;
      try {
        plain =
          mime === 'application/pdf'
            ? await extractTextFromPdf(req.file.buffer)
            : await extractTextFromDocx(req.file.buffer);
      } catch (err) {
        if (err instanceof HttpError) {
          res.status(err.status).json({ error: err.message, code: err.code });
          return;
        }
        res.status(400).json({
          error: 'Could not read CV file.',
          code: 'CV_PARSE_FAILED',
        });
        return;
      }

      let cvParsed;
      try {
        const rawCv = await claudeParseCvToJson(plain, req.requestId);
        cvParsed = profileCvSchema.safeParse(rawCv);
        if (!cvParsed.success) {
          res.status(400).json({
            error: 'Parsed CV failed schema validation; please correct manually.',
            code: 'CV_PARSE_FAILED',
            details: cvParsed.error.flatten(),
          });
          return;
        }
      } catch {
        res.status(502).json({
          error: 'CV parsing service failed; try again later.',
          code: 'CV_PARSE_FAILED',
        });
        return;
      }

      const cvJson = cvParsed.data;
      const cv_upload_id = randomUUID();
      const ref = userDocumentRef(db, uid);
      await ref.update({
        cv: cvJson,
        cv_upload_id,
        updated_at: FieldValue.serverTimestamp(),
      });

      const snap = await ref.get();
      const data = snap.data() as ProfileDocument;

      if (
        isProfileReadyForAgentmail(
          data.cv,
          data.questionnaire,
          data.preferences
        )
      ) {
        await provisionAgentMailIfNeeded(db, uid, req.requestId);
      }

      logger.info(
        { requestId: req.requestId, uid, cvChars: plain.length },
        'profile_cv_uploaded'
      );

      res.status(200).json({ cv: cvJson, cv_upload_id });
    } catch (err) {
      if (err instanceof Error && err.message.includes('GCS_BUCKET')) {
        res.status(503).json({ error: 'File storage unavailable', code: 'SERVICE_UNAVAILABLE' });
        return;
      }
      if (err instanceof Error && err.message.includes('not initialized')) {
        res.status(503).json({ error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' });
        return;
      }
      next(err);
    }
  }
);

profileRouter.put('/cv', requireAuth, express.json({ limit: '2mb' }), async (req, res, next) => {
  try {
    const parsed = profileCvSchemaStrict.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid CV JSON',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const db = getFirestore();
    const uid = req.uid!;
    await ensureUserDocument(db, uid, req.email ?? '', req.requestId);
    const ref = userDocumentRef(db, uid);
    await ref.update({
      cv: parsed.data,
      updated_at: FieldValue.serverTimestamp(),
    });

    const snap = await ref.get();
    const data = snap.data() as ProfileDocument;
    if (
      isProfileReadyForAgentmail(data.cv, data.questionnaire, data.preferences)
    ) {
      await provisionAgentMailIfNeeded(db, uid, req.requestId);
    }

    res.status(200).json({ cv: parsed.data });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not initialized')) {
      res.status(503).json({ error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' });
      return;
    }
    next(err);
  }
});

function findCompanyColumn(headers: string[]): string | null {
  const candidates = ['company', 'organization', 'employer', 'company name'];
  const norm = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = norm.indexOf(c);
    if (i >= 0) return headers[i];
  }
  return null;
}

profileRouter.post(
  '/linkedin',
  requireAuth,
  (req, res, next) => {
    uploadLinkedin.single('file')(req, res, (err) => {
      if (err) multerError(err, next);
      else next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file?.buffer) {
        res.status(400).json({ error: 'Missing file field "file"', code: 'VALIDATION_ERROR' });
        return;
      }

      let text = req.file.buffer.toString('utf8');
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }

      let records: Record<string, string>[];
      try {
        records = parse(text, {
          columns: true,
          skip_empty_lines: true,
          relax_column_count: true,
          trim: true,
        }) as Record<string, string>[];
      } catch {
        res.status(400).json({
          error: 'Invalid CSV encoding or format. Expected UTF-8 with a header row including a Company column.',
          code: 'VALIDATION_ERROR',
          details: { expected_headers_sample: ['First Name', 'Last Name', 'Company', 'Position'] },
        });
        return;
      }

      if (records.length === 0) {
        res.status(400).json({
          error: 'CSV has no data rows.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const headers = Object.keys(records[0]);
      const companyKey = findCompanyColumn(headers);
      if (!companyKey) {
        res.status(400).json({
          error:
            'Missing Company column. LinkedIn export should include a "Company" (or Organization) column.',
          code: 'VALIDATION_ERROR',
          details: { expected_headers_sample: ['First Name', 'Last Name', 'Company', 'Position'] },
        });
        return;
      }

      const firstNameKey =
        headers.find((h) => h.trim().toLowerCase() === 'first name') ??
        headers.find((h) => h.trim().toLowerCase() === 'firstname');
      const lastNameKey =
        headers.find((h) => h.trim().toLowerCase() === 'last name') ??
        headers.find((h) => h.trim().toLowerCase() === 'lastname');

      const slice = records.slice(0, LINKEDIN_MAX_ROWS);
      const rows = slice.map((r) => {
        const company = (r[companyKey] ?? '').trim();
        let name = '';
        if (firstNameKey || lastNameKey) {
          name = [r[firstNameKey ?? ''], r[lastNameKey ?? '']]
            .map((s) => (s ?? '').trim())
            .filter(Boolean)
            .join(' ');
        }
        return { company, name: name || undefined };
      });

      let linkedin_connections: unknown[];
      if (config.anthropicApiKey) {
        const batchSize = 200;
        const merged: unknown[] = [];
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize).filter((r) => r.company);
          if (batch.length === 0) continue;
          const normalized = await claudeNormalizeLinkedInCompanies(batch, req.requestId);
          merged.push(...normalized);
        }
        linkedin_connections = merged;
      } else {
        linkedin_connections = rows
          .filter((r) => r.company)
          .map((r) => ({ company_normalized: r.company, company_raw: r.company, name: r.name }));
      }

      const db = getFirestore();
      const uid = req.uid!;
      await ensureUserDocument(db, uid, req.email ?? '', req.requestId);
      const ref = userDocumentRef(db, uid);
      const snap = await ref.get();
      const cur = snap.data() as ProfileDocument;
      const preferences = {
        ...cur.preferences,
        linkedin_connections,
      };

      await ref.update({
        preferences,
        updated_at: FieldValue.serverTimestamp(),
      });

      if (isProfileReadyForAgentmail(cur.cv, cur.questionnaire, preferences)) {
        await provisionAgentMailIfNeeded(db, uid, req.requestId);
      }

      res.status(200).json({
        linkedin_connections,
        rows_imported: linkedin_connections.length,
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('not initialized')) {
        res.status(503).json({ error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' });
        return;
      }
      next(err);
    }
  }
);

profileRouter.put('/preferences', requireAuth, express.json({ limit: '256kb' }), async (req, res, next) => {
  try {
    const parsed = putPreferencesBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid preferences',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const db = getFirestore();
    const uid = req.uid!;
    await ensureUserDocument(db, uid, req.email ?? '', req.requestId);
    const ref = userDocumentRef(db, uid);
    const snap = await ref.get();
    const cur = snap.data() as ProfileDocument;

    const preferences = {
      ...parsed.data,
      linkedin_connections: cur.preferences.linkedin_connections,
    };

    await ref.update({
      preferences,
      updated_at: FieldValue.serverTimestamp(),
    });

    const nextSnap = await ref.get();
    const data = nextSnap.data() as ProfileDocument;
    if (isProfileReadyForAgentmail(data.cv, data.questionnaire, preferences)) {
      await provisionAgentMailIfNeeded(db, uid, req.requestId);
    }

    res.status(200).json({ preferences });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not initialized')) {
      res.status(503).json({ error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' });
      return;
    }
    next(err);
  }
});
