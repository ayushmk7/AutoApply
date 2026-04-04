import { existsSync, readFileSync } from 'fs';
import admin from 'firebase-admin';
import { config } from './config.js';
import { logger } from './logger.js';

function loadServiceAccountJson(): Record<string, unknown> | null {
  const p = config.firebaseServiceAccountPath;
  if (p && existsSync(p)) {
    const raw = readFileSync(p, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  }
  if (config.firebaseServiceAccountJson) {
    return JSON.parse(config.firebaseServiceAccountJson) as Record<string, unknown>;
  }
  if (config.firebaseServiceAccountBase64) {
    const raw = Buffer.from(config.firebaseServiceAccountBase64, 'base64').toString('utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  }
  if (config.firebaseProjectId && config.firebaseClientEmail && config.firebasePrivateKey) {
    return {
      type: 'service_account',
      project_id: config.firebaseProjectId,
      client_email: config.firebaseClientEmail,
      private_key: config.firebasePrivateKey,
    };
  }
  return null;
}

function resolveStorageBucket(projectId: string | undefined): string | undefined {
  if (config.gcsBucket) return config.gcsBucket;
  if (projectId) return `${projectId}.appspot.com`;
  return undefined;
}

/**
 * Initialize Firebase Admin once. Emulator: set `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` before start.
 * Without credentials and without emulators, Admin is not initialized (local HTTP-only dev).
 */
export function initFirebaseAdmin(): void {
  if (admin.apps.length > 0) return;

  const useFirestoreEmu = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const useAuthEmu = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

  if (useFirestoreEmu || useAuthEmu) {
    const projectId = config.firebaseProjectId || 'demo-autoapply';
    logger.info(
      {
        firestoreEmulator: process.env.FIRESTORE_EMULATOR_HOST,
        authEmulator: process.env.FIREBASE_AUTH_EMULATOR_HOST,
        projectId,
      },
      'firebase_admin_emulator'
    );
    admin.initializeApp({
      projectId,
      storageBucket: resolveStorageBucket(projectId),
    });
    return;
  }

  const json = loadServiceAccountJson();
  if (!json) {
    if (config.nodeEnv === 'production') {
      throw new Error('Firebase Admin: missing credentials in production');
    }
    logger.warn('firebase_admin_skipped_missing_credentials');
    return;
  }

  const projectId =
    (typeof json.project_id === 'string' && json.project_id) || config.firebaseProjectId || undefined;

  admin.initializeApp({
    credential: admin.credential.cert(json as admin.ServiceAccount),
    storageBucket: resolveStorageBucket(projectId),
  });
}

export function isFirebaseInitialized(): boolean {
  return admin.apps.length > 0;
}

export function getFirebaseAuth(): admin.auth.Auth {
  if (!isFirebaseInitialized()) {
    throw new Error('Firebase Admin is not initialized');
  }
  return admin.auth();
}

export function getFirestore(): admin.firestore.Firestore {
  if (!isFirebaseInitialized()) {
    throw new Error('Firebase Admin is not initialized');
  }
  return admin.firestore();
}

export function getFirebaseStorage(): admin.storage.Storage {
  if (!isFirebaseInitialized()) {
    throw new Error('Firebase Admin is not initialized');
  }
  return admin.storage();
}
