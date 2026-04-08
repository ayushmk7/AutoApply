import { useState } from 'react';
import { motion } from 'motion/react';
import { useApiSession } from '../context/ApiSessionContext';
import ScreenBackButton from './ScreenBackButton';

interface LoginPageProps {
  onAuthSuccess: () => void;
  onSkipToDemo: () => void;
  onBackToLanding: () => void;
}

export default function LoginPage({ onAuthSuccess, onSkipToDemo, onBackToLanding }: LoginPageProps) {
  const { signInEmail, signInGoogle, firebaseReady } = useApiSession();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const runAuth = async (mode: 'signin' | 'signup') => {
    setFormError(null);
    if (!firebaseReady) {
      setFormError('Firebase web SDK is not configured. Set VITE_FIREBASE_* env vars or use Skip demo.');
      return;
    }
    if (!email.trim() || !password) {
      setFormError('Email and password are required.');
      return;
    }
    if (mode === 'signup' && password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await signInEmail(email.trim(), password, mode);
      onAuthSuccess();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runGoogle = async () => {
    setFormError(null);
    if (!firebaseReady) {
      setFormError('Firebase web SDK is not configured.');
      return;
    }
    setBusy(true);
    try {
      await signInGoogle();
      onAuthSuccess();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-6">
      <ScreenBackButton ariaLabel="Back to home" onClick={onBackToLanding} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel w-full max-w-md p-8"
        style={{
          boxShadow:
            '0 8px 32px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.35), inset 0 1px 40px rgba(255, 255, 255, 0.15)',
        }}
      >
        <div className="flex gap-2 mb-8 glass-nested p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('signin')}
            className="flex-1 py-2.5 rounded-lg transition-all relative"
            style={{
              fontWeight: activeTab === 'signin' ? 800 : 200,
              color: activeTab === 'signin' ? '#1A1A1A' : '#6B6B6B',
            }}
          >
            {activeTab === 'signin' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 glass-nested rounded-lg"
                style={{ border: '1px solid rgba(255, 255, 255, 0.6)' }}
              />
            )}
            <span className="relative z-10">Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('signup')}
            className="flex-1 py-2.5 rounded-lg transition-all relative"
            style={{
              fontWeight: activeTab === 'signup' ? 800 : 200,
              color: activeTab === 'signup' ? '#1A1A1A' : '#6B6B6B',
            }}
          >
            {activeTab === 'signup' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 glass-nested rounded-lg"
                style={{ border: '1px solid rgba(255, 255, 255, 0.6)' }}
              />
            )}
            <span className="relative z-10">Create Account</span>
          </button>
        </div>

        {formError && (
          <p className="mb-4 text-sm" style={{ color: '#FF3B30', fontWeight: 400 }}>
            {formError}
          </p>
        )}

        {!firebaseReady && (
          <p className="mono mb-4 text-xs" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
            Firebase client env vars are missing. Use &quot;Skip Login&quot; for demo API mode, or configure
            VITE_FIREBASE_* in `.env` at the repo root.
          </p>
        )}

        {activeTab === 'signin' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div>
              <label className="mb-2 block" style={{ fontWeight: 200 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                className="w-full px-4 py-3 glass-nested rounded-lg outline-none focus:ring-2 focus:ring-[#0066FF] focus:ring-opacity-30 transition-all"
                style={{ fontWeight: 200 }}
              />
            </div>

            <div>
              <label className="mb-2 block" style={{ fontWeight: 200 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 glass-nested rounded-lg outline-none focus:ring-2 focus:ring-[#0066FF] focus:ring-opacity-30 transition-all"
                style={{ fontWeight: 200 }}
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void runAuth('signin')}
              className="btn-micro mt-6 w-full rounded-[var(--radius-lg)] py-3 text-white disabled:opacity-50"
              style={{
                background: '#0066FF',
                boxShadow: '0 8px 32px rgba(0, 102, 255, 0.3)',
              }}
            >
              Sign In
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }} />
              </div>
              <div className="relative flex justify-center">
                <span
                  className="px-4"
                  style={{ background: 'var(--glass-bg)', fontWeight: 200, color: '#6B6B6B' }}
                >
                  or
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void runGoogle()}
              className="btn-micro flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] py-3 glass-nested disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
          </motion.div>
        )}

        {activeTab === 'signup' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div>
              <label className="mb-2 block" style={{ fontWeight: 200 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                className="w-full px-4 py-3 glass-nested rounded-lg outline-none focus:ring-2 focus:ring-[#0066FF] focus:ring-opacity-30 transition-all"
                style={{ fontWeight: 200 }}
              />
            </div>

            <div>
              <label className="mb-2 block" style={{ fontWeight: 200 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 glass-nested rounded-lg outline-none focus:ring-2 focus:ring-[#0066FF] focus:ring-opacity-30 transition-all"
                style={{ fontWeight: 200 }}
              />
            </div>

            <div>
              <label className="mb-2 block" style={{ fontWeight: 200 }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 glass-nested rounded-lg outline-none focus:ring-2 focus:ring-[#0066FF] focus:ring-opacity-30 transition-all"
                style={{ fontWeight: 200 }}
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void runAuth('signup')}
              className="btn-micro mt-6 w-full rounded-[var(--radius-lg)] py-3 text-white disabled:opacity-50"
              style={{
                background: '#0066FF',
                boxShadow: '0 8px 32px rgba(0, 102, 255, 0.3)',
              }}
            >
              Create Account
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }} />
              </div>
              <div className="relative flex justify-center">
                <span
                  className="px-4"
                  style={{ background: 'var(--glass-bg)', fontWeight: 200, color: '#6B6B6B' }}
                >
                  or
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void runGoogle()}
              className="btn-micro flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] py-3 glass-nested disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
          </motion.div>
        )}
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        type="button"
        onClick={onSkipToDemo}
        className="mt-8 text-lg transition-all hover:underline"
        style={{ fontWeight: 800, color: '#0066FF' }}
      >
        Skip Login - Try the Demo
      </motion.button>
    </div>
  );
}
