/**
 * Phase 3.4 — Optional admin roles: set with Firebase Admin `auth.setCustomUserClaims(uid, { admin: true })`.
 * Never trust role hints from the client.
 */
export type AdminCustomClaims = {
  admin?: boolean;
};
