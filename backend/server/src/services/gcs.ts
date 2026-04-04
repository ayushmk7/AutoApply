import { getFirebaseStorage } from '../lib/firebase.js';
import { config } from '../lib/config.js';

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

type SignableFile = {
  getSignedUrl: (cfg: { version: 'v4'; action: 'read'; expires: number }) => Promise<[string]>;
};

/**
 * GCS object names must be safe; avoid raw user-facing titles in paths (Phase 2.4).
 */
export function sanitizeObjectSegment(segment: string, fallback: string): string {
  const t = segment.trim().slice(0, 200);
  if (t && SAFE_SEGMENT.test(t)) return t;
  return fallback;
}

export function gcsCvOriginalPath(uid: string, ext: string): string {
  const safeUid = sanitizeObjectSegment(uid, 'unknown');
  const safeExt = sanitizeObjectSegment(ext.replace(/^\./, ''), 'pdf');
  return `users/${safeUid}/cv/original.${safeExt}`;
}

/** Align with `backend/gcs-lifecycle.json` (90-day TTL on this prefix). */
export function gcsScreenshotPath(uid: string, applicationId: string, stage: string): string {
  const u = sanitizeObjectSegment(uid, 'unknown');
  const a = sanitizeObjectSegment(applicationId, 'app');
  const s = sanitizeObjectSegment(stage, 'stage');
  return `screenshots/${u}/${a}_${s}.png`;
}

export function gcsCoverLetterPath(uid: string, applicationId: string): string {
  const u = sanitizeObjectSegment(uid, 'unknown');
  const a = sanitizeObjectSegment(applicationId, 'app');
  return `users/${u}/cover-letters/${a}.pdf`;
}

export function gcsResumePdfPath(uid: string, applicationId: string): string {
  const u = sanitizeObjectSegment(uid, 'unknown');
  const a = sanitizeObjectSegment(applicationId, 'app');
  return `users/${u}/resumes/${a}.pdf`;
}

function requireBucketName(): string {
  const name = config.gcsBucket;
  if (!name) {
    throw new Error('GCS_BUCKET is not configured');
  }
  return name;
}

export function getBucket(): ReturnType<ReturnType<typeof getFirebaseStorage>['bucket']> {
  const bucketName = requireBucketName();
  return getFirebaseStorage().bucket(bucketName);
}

export async function getSignedReadUrl(
  file: SignableFile,
  expiresInSeconds: number
): Promise<{ url: string; expiresAt: string }> {
  const expires = Date.now() + expiresInSeconds * 1000;
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires,
  });
  return { url, expiresAt: new Date(expires).toISOString() };
}

export async function signedReadUrlForObject(
  objectPath: string,
  expiresInSeconds: number
): Promise<{ url: string; expiresAt: string }> {
  const file = getBucket().file(objectPath);
  return getSignedReadUrl(file, expiresInSeconds);
}

export async function uploadBufferToObject(
  objectPath: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const file = getBucket().file(objectPath);
  await file.save(body, {
    contentType,
    resumable: false,
    metadata: { cacheControl: 'private, max-age=0' },
  });
}

/** Phase 14 — download private object for outbound email attachments. */
export async function downloadObjectBuffer(objectPath: string): Promise<Buffer | null> {
  if (!config.gcsBucket) return null;
  try {
    const file = getBucket().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return buf;
  } catch {
    return null;
  }
}
