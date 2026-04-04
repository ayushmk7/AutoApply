import { Router } from 'express';
import { config } from '../lib/config.js';
import { getFirestore } from '../lib/firebase.js';
import { HttpError } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { userDocumentRef } from '../lib/firestorePaths.js';
import {
  completeSheetsOAuthAndEnable,
  createSheetsAuthorizationUrl,
  disableSheetsIntegration,
  fullSyncUserSheet,
  verifySheetsOAuthState,
} from '../services/googleSheetsSync.js';
import type { ProfilePreferences } from '../types/profile.js';

export const sheetsRouter = Router();

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/** Phase 15 — `POST /api/sheets/enable` returns Google OAuth URL (`docs/03_BACKEND_PRD.md` §3.7). */
sheetsRouter.post('/enable', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const url = await createSheetsAuthorizationUrl(uid);
    res.json({ authorization_url: url });
  } catch (err) {
    next(err);
  }
});

/** Browser redirect target — public (validates signed `state`). */
sheetsRouter.get('/oauth/callback', async (req, res) => {
  const fe = config.frontendUrl.replace(/\/$/, '');
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) {
      res.redirect(`${fe}/dashboard/settings?sheets_error=missing_params`);
      return;
    }
    const uid = await verifySheetsOAuthState(state);
    const db = getFirestore();
    await completeSheetsOAuthAndEnable(db, uid, code);
    res.redirect(`${fe}/dashboard/settings?sheets_status=connected`);
  } catch (err) {
    logger.warn({ err }, 'sheets_oauth_callback_error');
    res.redirect(`${fe}/dashboard/settings?sheets_error=1`);
  }
});

sheetsRouter.post('/disable', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const db = getFirestore();
    await disableSheetsIntegration(db, uid, 'user_disabled');
    res.json({ disabled: true });
  } catch (err) {
    next(err);
  }
});

sheetsRouter.post('/sync', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const db = getFirestore();
    await fullSyncUserSheet(db, uid, req.requestId ?? 'sheets-sync');
    res.json({ synced: true });
  } catch (err) {
    next(err);
  }
});

sheetsRouter.get('/status', requireAuth, async (req, res, next) => {
  try {
    const uid = req.uid;
    if (!uid) {
      next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    const db = getFirestore();
    const snap = await userDocumentRef(db, uid).get();
    const data = snap.data() as
      | {
          preferences?: ProfilePreferences;
          sheets_last_sync_at?: unknown;
          sheets_sync_error?: string;
        }
      | undefined;
    const p = data?.preferences;
    res.json({
      enabled: Boolean(p?.sheets_enabled),
      spreadsheet_id: p?.sheets_id ?? '',
      last_sync_at: toIso(data?.sheets_last_sync_at),
      sync_error: data?.sheets_sync_error ?? null,
    });
  } catch (err) {
    next(err);
  }
});
