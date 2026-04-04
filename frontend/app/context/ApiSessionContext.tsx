import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import { apiFetchJson } from '../lib/api';
import { readFirebaseWebConfig } from '../lib/env';

type ApiSessionContextValue = {
  accessToken: string | null;
  setAccessToken: (t: string | null) => void;
  signInDemo: () => Promise<void>;
  signOutSession: () => Promise<void>;
  signInEmail: (email: string, password: string, mode: 'signin' | 'signup') => Promise<void>;
  signInGoogle: () => Promise<void>;
  firebaseReady: boolean;
};

const ApiSessionContext = createContext<ApiSessionContextValue | null>(null);

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

function getOrInitFirebase(): { auth: Auth } | null {
  const cfg = readFirebaseWebConfig();
  if (!cfg) return null;
  if (!firebaseApp) {
    firebaseApp = initializeApp(cfg);
    firebaseAuth = getAuth(firebaseApp);
  }
  return { auth: firebaseAuth! };
}

export function ApiSessionProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('autoapply_access_token');
    } catch {
      return null;
    }
  });

  const persistToken = useCallback((t: string | null) => {
    setAccessToken(t);
    try {
      if (t) sessionStorage.setItem('autoapply_access_token', t);
      else sessionStorage.removeItem('autoapply_access_token');
    } catch {
      /* ignore */
    }
  }, []);

  const signInDemo = useCallback(async () => {
    const res = await apiFetchJson<{ token: string }>('/api/auth/skip', { method: 'POST' });
    persistToken(res.token);
  }, [persistToken]);

  const signOutSession = useCallback(async () => {
    const fb = getOrInitFirebase();
    if (fb) {
      try {
        await signOut(fb.auth);
      } catch {
        /* ignore */
      }
    }
    persistToken(null);
  }, [persistToken]);

  const afterFirebaseSignIn = useCallback(
    async (auth: Auth) => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No Firebase ID token');
      persistToken(token);
      const email = auth.currentUser?.email ?? undefined;
      await apiFetchJson('/api/auth/register', {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({ email }),
      });
    },
    [persistToken]
  );

  const signInEmail = useCallback(
    async (email: string, password: string, mode: 'signin' | 'signup') => {
      const fb = getOrInitFirebase();
      if (!fb) throw new Error('Firebase is not configured (set VITE_FIREBASE_* env vars).');
      const e = email.trim();
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(fb.auth, e, password);
      } else {
        await signInWithEmailAndPassword(fb.auth, e, password);
      }
      await afterFirebaseSignIn(fb.auth);
    },
    [afterFirebaseSignIn]
  );

  const signInGoogle = useCallback(async () => {
    const fb = getOrInitFirebase();
    if (!fb) throw new Error('Firebase is not configured (set VITE_FIREBASE_* env vars).');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(fb.auth, provider);
    await afterFirebaseSignIn(fb.auth);
  }, [afterFirebaseSignIn]);

  const value = useMemo(
    () => ({
      accessToken,
      setAccessToken: persistToken,
      signInDemo,
      signOutSession,
      signInEmail,
      signInGoogle,
      firebaseReady: readFirebaseWebConfig() !== null,
    }),
    [accessToken, persistToken, signInDemo, signOutSession, signInEmail, signInGoogle]
  );

  return <ApiSessionContext.Provider value={value}>{children}</ApiSessionContext.Provider>;
}

export function useApiSession(): ApiSessionContextValue {
  const ctx = useContext(ApiSessionContext);
  if (!ctx) throw new Error('useApiSession must be used within ApiSessionProvider');
  return ctx;
}
