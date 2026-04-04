/** Firebase web SDK config; all keys must come from env (Phase 20.4). */
export function readFirebaseWebConfig(): {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
  storageBucket: string;
} | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim();
  if (!apiKey || !authDomain || !projectId || !appId || !messagingSenderId || !storageBucket) {
    return null;
  }
  return { apiKey, authDomain, projectId, appId, messagingSenderId, storageBucket };
}
