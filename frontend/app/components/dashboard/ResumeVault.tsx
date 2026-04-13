import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useModals } from '../../context/ModalContext';
import { demoResumes } from '../../data/demoData';
import { useApiSession } from '../../context/ApiSessionContext';
import { ApiError, apiFetchJson } from '../../lib/api';
import { fetchApplicationsWithListing, type ApiApplicationRow } from '../../lib/dashboardApi';
import { useDashboardContext } from '../Dashboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Switch } from '../ui/switch';

export default function ResumeVault() {
  const { demoMode } = useDashboardContext();
  const { accessToken } = useApiSession();
  const { openAts } = useModals();
  const [company, setCompany] = useState('All');
  const [atsMin, setAtsMin] = useState(0);
  const [atsMax, setAtsMax] = useState(100);
  const [pdfResumeId, setPdfResumeId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [forceEmpty, setForceEmpty] = useState(false);
  const [apiRows, setApiRows] = useState<ApiApplicationRow[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const source = demoMode ? (forceEmpty ? [] : demoResumes) : [];

  useEffect(() => {
    if (demoMode || !accessToken) return;
    setApiLoading(true);
    setApiError(null);
    void fetchApplicationsWithListing(accessToken)
      .then((rows) => setApiRows(rows.filter((r) => Boolean(r.application.resume_url || r.application.cover_letter_url))))
      .catch((err) => setApiError(err instanceof ApiError ? err.message : String(err)))
      .finally(() => setApiLoading(false));
  }, [demoMode, accessToken]);

  const filtered = useMemo(() => {
    return source.filter((r) => {
      if (company !== 'All' && r.company !== company) return false;
      if (r.atsScore < atsMin || r.atsScore > atsMax) return false;
      return true;
    });
  }, [source, company, atsMin, atsMax]);

  const companies = ['All', ...Array.from(new Set(demoResumes.map((r) => r.company)))];

  const pdfResume = filtered.find((r) => r.id === pdfResumeId);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#00B341';
    if (score >= 60) return '#F5A623';
    return '#FF3B30';
  };

  if (demoMode && filtered.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-center" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
          Resume Vault
        </h1>
        <div className="glass-panel p-10 text-center">
          <p className="mono mb-4 text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
            No resumes generated yet. They appear here after each application.
          </p>
          {demoMode && forceEmpty && (
            <button
              type="button"
              className="btn-micro rounded-[var(--radius-lg)] px-6 py-2 glass-nested"
              onClick={() => setForceEmpty(false)}
            >
              Restore resumes
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {demoMode && <div className="mb-8">
        <div className="mb-6 text-center">
          <h1 style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>Resume Vault</h1>
          {demoMode && (
            <button
              type="button"
              className="mono mt-3 text-xs underline"
              style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}
              onClick={() => setForceEmpty(true)}
            >
              Test empty state
            </button>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <select
            className="rounded-[var(--radius-md)] px-4 py-2 glass-nested"
            style={{ fontWeight: 200 }}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All Companies' : c}
              </option>
            ))}
          </select>
          <select className="rounded-[var(--radius-md)] px-4 py-2 glass-nested" style={{ fontWeight: 200 }}>
            <option>Sort by Date</option>
            <option>Sort by ATS Score</option>
            <option>Sort by Company</option>
          </select>
        </div>
      </div>}

      {demoMode && <div className="glass-panel mb-8 p-6">
        <p className="mb-3" style={{ fontWeight: 800 }}>
          ATS score range
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mono mb-1 block text-xs" style={{ fontWeight: 400 }}>
              Min: {atsMin}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={atsMin}
              onChange={(e) => setAtsMin(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="mono mb-1 block text-xs" style={{ fontWeight: 400 }}>
              Max: {atsMax}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={atsMax}
              onChange={(e) => setAtsMax(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>}

      {demoMode && <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((resume, i) => (
          <motion.div
            key={resume.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
            className="glass-panel cursor-pointer overflow-hidden transition-transform hover:scale-[1.01]"
            onClick={() => setPdfResumeId(resume.id)}
          >
            <div
              className="flex h-64 items-center justify-center border-b glass-nested"
              style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}
            >
              <div className="p-8 text-center">
                <div style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }} className="mb-4 text-3xl">
                  {resume.company}
                </div>
                <div style={{ fontWeight: 200 }} className="text-sm text-[#6B6B6B]">
                  Resume preview
                </div>
                <div className="mt-4 space-y-2 text-xs" style={{ fontWeight: 200 }}>
                  <div className="h-2 w-full rounded glass-nested" />
                  <div className="h-2 w-3/4 rounded glass-nested" />
                  <div className="h-2 w-5/6 rounded glass-nested" />
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="mb-3">
                <h3 className="mb-1" style={{ fontWeight: 800 }}>
                  {resume.company}
                </h3>
                <div style={{ fontWeight: 200 }} className="text-sm text-[#6B6B6B]">
                  {resume.role}
                </div>
              </div>
              <div className="mb-3 flex items-center justify-between">
                <span className="mono text-xs text-[#6B6B6B]" style={{ fontWeight: 400 }}>
                  {resume.date}
                </span>
                <button
                  type="button"
                  className="mono text-xl tabular-nums"
                  style={{ color: getScoreColor(resume.atsScore), fontWeight: 900 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAts({ score: resume.atsScore });
                  }}
                >
                  {resume.atsScore}
                </button>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {resume.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2 py-1 text-xs"
                    style={{ background: 'rgba(0, 102, 255, 0.1)', color: '#0066FF', fontWeight: 800 }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div
                className="mb-3 flex items-center justify-between gap-2 rounded-[var(--radius-md)] glass-nested px-3 py-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span style={{ fontWeight: 200 }} className="text-sm">
                  Compare with original CV
                </span>
                <Switch
                  checked={compareId === resume.id}
                  onCheckedChange={(v) => setCompareId(v ? resume.id : null)}
                />
              </div>
              {compareId === resume.id && (
                <div
                  className="mb-3 grid grid-cols-2 gap-2 rounded-[var(--radius-md)] glass-nested p-3 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <p style={{ fontWeight: 800 }}>Original CV</p>
                    <p style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>General-purpose bullets.</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 800 }}>Tailored</p>
                    <p style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                      Emphasized {resume.tags[0]} for {resume.company}.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn-micro flex-1 rounded-[var(--radius-lg)] py-2 text-sm text-white"
                  style={{ background: '#0066FF' }}
                  onClick={() => setPdfResumeId(resume.id)}
                >
                  View PDF
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>}
      {!demoMode && (
        <div className="glass-panel p-6 text-sm">
          {apiLoading ? (
            <p style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>Loading artifact history...</p>
          ) : apiError ? (
            <p style={{ fontWeight: 400, color: '#FF3B30' }}>{apiError}</p>
          ) : apiRows.length === 0 ? (
            <p style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
              No generated artifacts yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {apiRows.map((row) => (
                <li key={row.application.id} className="flex items-center justify-between rounded-[var(--radius-md)] glass-nested px-3 py-2">
                  <div>
                    <div style={{ fontWeight: 800 }}>{row.listing?.company ?? '—'} — {row.listing?.role ?? '—'}</div>
                    <div className="text-xs" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                      status: {row.application.status}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-micro rounded-[var(--radius-md)] px-3 py-1 glass-nested"
                      onClick={() => void openArtifact(accessToken, row.application.id, 'resume')}
                    >
                      Resume PDF
                    </button>
                    <button
                      type="button"
                      className="btn-micro rounded-[var(--radius-md)] px-3 py-1 glass-nested"
                      onClick={() => void openArtifact(accessToken, row.application.id, 'cover-letter')}
                    >
                      Cover Letter
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {demoMode && <Dialog open={!!pdfResume} onOpenChange={(o) => !o && setPdfResumeId(null)}>
        <DialogContent className="glass-panel max-h-[90vh] max-w-2xl overflow-y-auto border-0 sm:max-w-2xl [&]:rounded-[var(--radius-2xl)] [&]:bg-[var(--glass-bg)] [&]:p-8">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>
              {pdfResume?.company} — PDF preview
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-[400px] space-y-3 rounded-[var(--radius-xl)] glass-nested p-6">
            {[1, 2, 3, 4, 5, 6].map((line) => (
              <div key={line} className="h-3 rounded glass-nested" style={{ width: `${90 - line * 5}%` }} />
            ))}
            <p className="mono pt-4 text-xs" style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
              Placeholder preview — connect backend PDF viewer later.
            </p>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  );
}

async function openArtifact(
  accessToken: string | null,
  applicationId: string,
  kind: 'resume' | 'cover-letter'
): Promise<void> {
  if (!accessToken) return;
  const res = await apiFetchJson<{ url: string }>(
    `/api/applications/${encodeURIComponent(applicationId)}/${kind}`,
    { accessToken }
  );
  if (res.url) {
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }
}
