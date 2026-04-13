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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minFit, setMinFit] = useState(0);
  const [companyQ, setCompanyQ] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: '25',
        page: String(page),
      });
      if (minFit > 0) params.set('min_fit_score', String(minFit));
      if (companyQ.trim()) params.set('company', companyQ.trim());
      const res = await apiFetchJson<{ jobs: JobRow[]; total?: number }>(`/api/jobs?${params.toString()}`, {
        accessToken,
      });
      setRows(res.jobs ?? []);
      setTotal(Number(res.total ?? 0));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, minFit, companyQ]);

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

  const skip = async (listingId: string) => {
    if (!accessToken) return;
    try {
      await apiFetchJson(`/api/jobs/${encodeURIComponent(listingId)}/skip`, {
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
        <div className="flex gap-2">
          <input
            className="rounded-[var(--radius-md)] px-2 py-1 text-xs glass-nested"
            placeholder="Company"
            value={companyQ}
            onChange={(e) => {
              setPage(1);
              setCompanyQ(e.target.value);
            }}
          />
          <input
            className="w-20 rounded-[var(--radius-md)] px-2 py-1 text-xs glass-nested"
            placeholder="Min fit"
            type="number"
            value={minFit}
            onChange={(e) => {
              setPage(1);
              setMinFit(Number(e.target.value || 0));
            }}
          />
          <button
            type="button"
            className="mono text-xs underline"
            style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
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
              <button
                type="button"
                className="btn-micro rounded-[var(--radius-lg)] px-3 py-2 glass-nested"
                onClick={() => void skip(id)}
              >
                Skip
              </button>
            </li>
          );
        })}
      </ul>
      {total > 25 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn-micro rounded-[var(--radius-md)] px-3 py-1 glass-nested disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="mono text-xs" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
            Page {page}
          </span>
          <button
            type="button"
            className="btn-micro rounded-[var(--radius-md)] px-3 py-1 glass-nested disabled:opacity-40"
            disabled={rows.length < 25}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
