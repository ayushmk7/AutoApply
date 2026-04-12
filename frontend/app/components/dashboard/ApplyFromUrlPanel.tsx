import { useState } from 'react';
import { useApiSession } from '../../context/ApiSessionContext';
import { apiFetchJson, ApiError } from '../../lib/api';

/**
 * Phase 20.6 — Apply from link (`POST /api/jobs/from-url`).
 */
export default function ApplyFromUrlPanel() {
  const { accessToken } = useApiSession();
  const [url, setUrl] = useState('');
  const [jd, setJd] = useState('');
  const [showJd, setShowJd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastApplicationId, setLastApplicationId] = useState<string | null>(null);

  if (!accessToken) return null;

  const submit = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await apiFetchJson<{
        application_id: string;
        listing_id: string;
        status: string;
        message: string;
        reused?: boolean;
      }>('/api/jobs/from-url', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({
          url: url.trim() || undefined,
          job_description_text: jd.trim() || undefined,
        }),
      });
      setMessage(res.message ?? 'Queued');
      setLastApplicationId(res.application_id);
      if (!res.reused) {
        setUrl('');
        setJd('');
      }
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message}${e.code ? ` (${e.code})` : ''}` : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel mb-6 p-6">
      <h2 className="mb-2" style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>
        Apply from a link
      </h2>
      <p className="mono mb-4 text-xs" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
        Paste a job or application URL. If the page is blocked, expand and paste the job description.
      </p>
      <label className="mb-1 block text-sm" style={{ fontWeight: 200 }}>
        URL
      </label>
      <input
        className="mb-3 w-full rounded-[var(--radius-md)] px-4 py-2 glass-nested"
        style={{ fontWeight: 200 }}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
      />
      <button
        type="button"
        className="mono mb-4 text-xs underline"
        style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}
        onClick={() => setShowJd((s) => !s)}
      >
        {showJd ? 'Hide' : 'Paste job description instead / in addition'}
      </button>
      {showJd && (
        <>
          <label className="mb-1 block text-sm" style={{ fontWeight: 200 }}>
            Job description
          </label>
          <textarea
            className="mb-3 min-h-[120px] w-full rounded-[var(--radius-md)] px-4 py-2 glass-nested"
            style={{ fontWeight: 200 }}
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
        </>
      )}
      <button
        type="button"
        disabled={loading || (!url.trim() && !jd.trim())}
        className="btn-micro w-full rounded-[var(--radius-lg)] py-3 text-white disabled:opacity-50"
        style={{ background: '#0066FF' }}
        onClick={() => void submit()}
      >
        {loading ? 'Submitting…' : 'Start application'}
      </button>
      {message && (
        <p className="mt-3 text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
          {message}
          {lastApplicationId ? ` (${lastApplicationId})` : ''}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm" style={{ fontWeight: 400, color: '#FF3B30' }}>
          {error}
        </p>
      )}
    </div>
  );
}
