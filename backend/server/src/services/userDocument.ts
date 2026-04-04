import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { userDocumentRef } from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';
import type { ProfileCv, ProfilePreferences, ProfileQuestionnaire } from '../types/profile.js';

const emptyCv: ProfileCv = {
  education: [],
  experience: [],
  projects: [],
  skills: { languages: [], frameworks: [], tools: [], other: [] },
  extracurriculars: [],
  awards: [],
  publications: [],
  certifications: [],
};

const emptyQuestionnaire: ProfileQuestionnaire = {
  work_auth: {
    authorized: false,
    sponsorship_needed: false,
    citizenship: '',
    visa_type: '',
  },
  demographics: { gender: '', ethnicity: '', veteran: '', disability: '' },
  education_meta: { graduation_date: '', student_status: false },
  availability: {
    start_date: '',
    terms: [],
    locations: [],
    relocate: false,
    remote_ok: false,
  },
  defaults: { hear_about: '', salary: '' },
  essays: {
    technical_project: '',
    teamwork: '',
    challenge: '',
    motivation: '',
  },
};

const defaultPreferences: ProfilePreferences = {
  resume_template: 'jakes',
  auto_apply_threshold: 75,
  daily_limit: 20,
  sheets_enabled: false,
  sheets_id: '',
  calendar_connected: false,
  linkedin_connections: [],
};

export function buildNewUserPayload(
  uid: string,
  email: string,
  options: { isDemo?: boolean } = {}
): Record<string, unknown> {
  return {
    uid,
    email,
    cv: emptyCv,
    questionnaire: emptyQuestionnaire,
    preferences: defaultPreferences,
    agentmail_address: '',
    is_demo: options.isDemo === true,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };
}

/**
 * `users/{uid}` — idempotent create (Phase 3.2). Uses a transaction to avoid duplicate creates under races.
 */
export async function ensureUserDocument(
  db: Firestore,
  uid: string,
  email: string,
  requestId: string,
  options: { isDemo?: boolean } = {}
): Promise<{ created: boolean }> {
  const ref = userDocumentRef(db, uid);
  let created = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      return;
    }
    created = true;
    tx.set(ref, buildNewUserPayload(uid, email, options));
  });

  if (created) {
    logger.info({ requestId, uid, isDemo: options.isDemo }, 'user_document_created');
  }

  return { created };
}
