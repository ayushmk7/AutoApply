import type { NextFunction, Request, Response } from 'express';
import { config } from '../lib/config.js';
import { verifyDemoToken } from '../lib/demoJwt.js';
import { getFirebaseAuth, isFirebaseInitialized } from '../lib/firebase.js';

/**
 * Extract Bearer token; tolerates extra spaces after `Bearer` (Phase 3.1).
 * `checkRevoked` for ID tokens is left `false` to avoid extra latency; enable if you need immediate revocation checks.
 */
export function parseBearerToken(req: Request): string | null {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const m = /^Bearer\s+(\S+)\s*$/i.exec(trimmed);
  return m ? m[1] : null;
}

/** Firebase ID token only — for `POST /api/auth/register` (Phase 3.2). */
export async function requireFirebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = parseBearerToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Missing or invalid authorization header',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  try {
    if (!isFirebaseInitialized()) {
      res.status(503).json({
        error: 'Authentication service unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
      return;
    }
    const auth = getFirebaseAuth();
    const decoded = await auth.verifyIdToken(token, false);
    req.uid = decoded.uid;
    req.email = decoded.email || '';
    req.authKind = 'firebase';
    next();
  } catch {
    res.status(401).json({
      error: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
    });
  }
}

/**
 * Firebase Bearer **or** signed demo JWT (Phase 3.1 / 3.3).
 * Demo tokens are only accepted when `NODE_ENV !== 'production'` or `ENABLE_DEMO_SKIP=true`.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = parseBearerToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Missing or invalid authorization header',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  if (isFirebaseInitialized()) {
    try {
      const auth = getFirebaseAuth();
      const decoded = await auth.verifyIdToken(token, false);
      req.uid = decoded.uid;
      req.email = decoded.email || '';
      req.authKind = 'firebase';
      next();
      return;
    } catch {
      // Fall through to demo token when allowed
    }
  }

  const allowDemo = config.nodeEnv !== 'production' || config.enableDemoSkip;
  if (!allowDemo) {
    res.status(401).json({
      error: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const sub = await verifyDemoToken(token);
  if (!sub) {
    res.status(401).json({
      error: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  req.uid = sub;
  req.email = '';
  req.authKind = 'demo';
  next();
}
