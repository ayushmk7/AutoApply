import { useCallback, useEffect, useState } from 'react';
import { useApiSession } from '../../context/ApiSessionContext';
import { apiFetchJson, ApiError } from '../../lib/api';

type JobRow = {
  listing: Record<string, unknown>;
  fit_score: number | null;
  referral_available: boolean | null;
  application: Record<string, unknown> | null;
};

export default function ApiJobsList() {
  const { accessToken } = useApiSession();
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetchJson<{ jobs: JobRow[] }>('/api/jobs?limit=50', {
        accessToken,
      });
      setRows(res.jobs ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (listingId: string) => {
    if (!accessToken) return;
    try {
      await apiFetchJson(`/api/jobs/${encodeURIComponent(listingId)}/approve`, {
        method: 'POST',
        accessToken,
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  if (!accessToken) return null;

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>Your job queue (API)</h2>
        <button
          type="button"
          className="mono text-xs underline"
          style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {loading && <p style={{ fontWeight: 200 }}>Loading…</p>}
      {error && <p style={{ fontWeight: 400, color: '#FF3B30' }}>{error}</p>}
      {!loading && rows.length === 0 && (
        <p className="mono text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
          No listings yet. Run the scraper or use Apply from a link above.
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((r) => {
          const id = String(r.listing.id ?? '');
          const company = String(r.listing.company ?? '');
          const role = String(r.listing.role ?? '');
          const appStatus = r.application ? String(r.application.status ?? '') : '';
          return (
            <li key={id || role + company} className="glass-panel flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div style={{ fontWeight: 700 }}>{role}</div>
                <div className="text-sm" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                  {company}
                  {r.fit_score != null ? ` · Fit ${r.fit_score}` : ''}
                  {appStatus ? ` · ${appStatus}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 text-white disabled:opacity-40"
                style={{ background: '#0066FF' }}
                disabled={Boolean(appStatus === 'queued' || appStatus === 'applying' || appStatus === 'applied')}
                onClick={() => void approve(id)}
              >
                Approve apply
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
