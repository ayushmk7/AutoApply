import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useModals } from '../../context/ModalContext';
import { demoApplications, type DemoApplication } from '../../data/demoData';
import { useApiSession } from '../../context/ApiSessionContext';
import { ApiError, apiFetchJson } from '../../lib/api';
import { describeWhen, fetchApplicationsWithListing, type ApiApplicationRow } from '../../lib/dashboardApi';
import { useDashboardContext } from '../Dashboard';

type TabId = 'all' | 'applied' | 'waiting' | 'interviews' | 'rejected' | 'offers' | 'manual';

export default function ApplicationsTracker() {
  const { demoMode } = useDashboardContext();
  const { accessToken } = useApiSession();
  const { openAtsFromApplication, openInterview } = useModals();
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [forceEmpty, setForceEmpty] = useState(false);
  const [apiRows, setApiRows] = useState<ApiApplicationRow[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const applications = demoMode ? (forceEmpty ? [] : demoApplications) : [];

  useEffect(() => {
    if (demoMode || !accessToken) return;
    setApiLoading(true);
    setApiError(null);
    void fetchApplicationsWithListing(accessToken)
      .then((rows) => setApiRows(rows))
      .catch((err) => setApiError(err instanceof ApiError ? err.message : String(err)))
      .finally(() => setApiLoading(false));
  }, [demoMode, accessToken]);

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'applied') return app.status === 'applied';
      if (activeTab === 'waiting') return app.status === 'waiting';
      if (activeTab === 'interviews') return app.status === 'interview';
      if (activeTab === 'rejected') return app.status === 'rejected';
      if (activeTab === 'offers') return app.status === 'offer';
      if (activeTab === 'manual') return app.status === 'manual_needed';
      return true;
    });
  }, [applications, activeTab]);

  const getStatusColor = (status: DemoApplication['status']) => {
    switch (status) {
      case 'applied':
        return '#0066FF';
      case 'waiting':
        return '#F5A623';
      case 'interview':
        return '#00B341';
      case 'rejected':
        return '#FF3B30';
      case 'offer':
        return '#00B341';
      case 'manual_needed':
        return '#AF52DE';
      default:
        return '#6B6B6B';
    }
  };

  const getStatusLabel = (status: DemoApplication['status']) => {
    switch (status) {
      case 'applied':
        return 'Applied';
      case 'waiting':
        return 'Waiting';
      case 'interview':
        return 'Interview';
      case 'rejected':
        return 'Rejected';
      case 'offer':
        return 'Offer';
      case 'manual_needed':
        return 'Manual Needed';
      default:
        return status;
    }
  };

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: applications.length },
    { id: 'applied', label: 'Applied', count: applications.filter((a) => a.status === 'applied').length },
    { id: 'waiting', label: 'Waiting', count: applications.filter((a) => a.status === 'waiting').length },
    { id: 'interviews', label: 'Interviews', count: applications.filter((a) => a.status === 'interview').length },
    { id: 'rejected', label: 'Rejected', count: applications.filter((a) => a.status === 'rejected').length },
    { id: 'offers', label: 'Offers', count: applications.filter((a) => a.status === 'offer').length },
    { id: 'manual', label: 'Manual Needed', count: applications.filter((a) => a.status === 'manual_needed').length },
  ];

  if (demoMode && applications.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-center" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
          Applications
        </h1>
        <div className="glass-panel p-10 text-center">
          <p className="mono mb-4 text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
            No applications submitted yet. Head to the Jobs Board to get started.
          </p>
          <button type="button" className="btn-micro rounded-[var(--radius-lg)] px-6 py-2 glass-nested">
            Open Jobs Board
          </button>
          {demoMode && forceEmpty && (
            <button
              type="button"
              className="btn-micro mt-4 block w-full rounded-[var(--radius-lg)] py-2 glass-nested"
              onClick={() => setForceEmpty(false)}
            >
              Restore sample applications
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 text-center">
        <h1 style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>Applications</h1>
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

      {demoMode && <div className="glass-panel relative mb-6 flex flex-wrap gap-2 overflow-x-auto p-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="relative rounded-[var(--radius-xl)] px-4 py-2 whitespace-nowrap transition-all"
              style={{
                fontWeight: active ? 800 : 200,
                color: active ? '#1A1A1A' : '#6B6B6B',
              }}
            >
              {active && (
                <motion.div
                  layoutId="appTabPill"
                  className="absolute inset-0 rounded-[var(--radius-xl)] glass-nested"
                  style={{ border: '1px solid rgba(255, 255, 255, 0.6)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {tab.label}
                <span className="mono ml-2 text-xs opacity-70" style={{ fontWeight: 400 }}>
                  {tab.count}
                </span>
              </span>
            </button>
          );
        })}
      </div>}

      {demoMode && <div className="glass-panel overflow-hidden">
        {filteredApps.length === 0 ? (
          <div className="p-10 text-center">
            <p className="mono text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
              No applications in this tab.
            </p>
          </div>
        ) : (
          <>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                {['Company', 'Role', 'Date', 'Method', 'Fit', 'ATS', 'Status', 'Response', 'Days', 'Next Action'].map(
                  (h) => (
                    <th key={h} className="p-4 text-left" style={{ fontWeight: 800 }}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filteredApps.map((app, i) => (
                <ApplicationRowDesktop
                  key={app.id}
                  app={app}
                  index={i}
                  expanded={expandedApp === app.id}
                  onToggle={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                  getStatusColor={getStatusColor}
                  getStatusLabel={getStatusLabel}
                  onAts={() => app.atsScore > 0 && openAtsFromApplication(app)}
                  onInterview={() =>
                    openInterview({ company: app.company, role: app.role })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 lg:hidden">
          {filteredApps.map((app, i) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.03 }}
              className="glass-nested cursor-pointer p-4"
              onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div style={{ fontWeight: 800 }}>{app.company}</div>
                  <div style={{ fontWeight: 200 }} className="text-sm text-[#6B6B6B]">
                    {app.role}
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-1 text-xs"
                  style={{
                    background: `${getStatusColor(app.status)}20`,
                    color: getStatusColor(app.status),
                    fontWeight: 800,
                  }}
                >
                  {getStatusLabel(app.status)}
                </span>
              </div>
              <p className="mono mb-2 text-xs" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                Response: {app.response ?? '—'}
              </p>
              <div className="flex flex-wrap gap-3 text-xs" style={{ fontWeight: 200 }}>
                <span className="mono">{app.date}</span>
                <span>
                  Fit:{' '}
                  <span className="mono" style={{ fontWeight: 400 }}>
                    {app.fitScore}
                  </span>
                </span>
                <button
                  type="button"
                  className="mono underline"
                  style={{ fontWeight: 400, color: '#0066FF' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (app.atsScore > 0) openAtsFromApplication(app);
                  }}
                >
                  ATS: {app.atsScore > 0 ? app.atsScore : '—'}
                </button>
              </div>
              {app.nextAction && (
                <button
                  type="button"
                  className="btn-micro mt-3 w-full rounded-[var(--radius-lg)] px-3 py-2 text-xs glass-nested"
                  style={{ color: '#0066FF' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {app.nextAction}
                </button>
              )}
              {expandedApp === app.id && (
                <DetailPanel app={app} onInterview={() => openInterview({ company: app.company, role: app.role })} />
              )}
            </motion.div>
          ))}
        </div>
          </>
        )}
      </div>}
      {!demoMode && (
        <div className="glass-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/40 p-4">
            <h2 style={{ fontWeight: 800 }}>API Applications</h2>
            <span className="mono text-xs" style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {apiRows.length} rows
            </span>
          </div>
          {apiLoading ? (
            <div className="p-6 text-sm" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
              Loading applications...
            </div>
          ) : apiError ? (
            <div className="p-6 text-sm" style={{ fontWeight: 400, color: '#FF3B30' }}>
              {apiError}
            </div>
          ) : apiRows.length === 0 ? (
            <div className="p-6 text-sm" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
              No applications yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/40">
                    {['Company', 'Role', 'Status', 'Fit', 'ATS', 'Updated', 'Actions'].map((h) => (
                      <th key={h} className="p-3 text-left text-sm" style={{ fontWeight: 800 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apiRows.map((row) => (
                    <tr key={row.application.id} className="border-b border-white/20">
                      <td className="p-3" style={{ fontWeight: 800 }}>
                        {row.listing?.company ?? '—'}
                      </td>
                      <td className="p-3 text-sm" style={{ fontWeight: 200 }}>
                        {row.listing?.role ?? '—'}
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-white/20 px-2 py-1 text-xs" style={{ fontWeight: 800 }}>
                          {row.application.status}
                        </span>
                      </td>
                      <td className="mono p-3 text-sm" style={{ fontWeight: 400 }}>
                        {row.application.fit_score ?? '—'}
                      </td>
                      <td className="mono p-3 text-sm" style={{ fontWeight: 400 }}>
                        {row.application.ats_score ?? '—'}
                      </td>
                      <td className="p-3 text-sm" style={{ fontWeight: 200 }}>
                        {describeWhen(row.application.updated_at)}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-micro rounded-[var(--radius-md)] px-2 py-1 text-xs glass-nested"
                            onClick={() => void openArtifact(accessToken, row.application.id, 'resume')}
                          >
                            Resume
                          </button>
                          <button
                            type="button"
                            className="btn-micro rounded-[var(--radius-md)] px-2 py-1 text-xs glass-nested"
                            onClick={() => void openArtifact(accessToken, row.application.id, 'cover-letter')}
                          >
                            Cover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
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

function ApplicationRowDesktop({
  app,
  index,
  expanded,
  onToggle,
  getStatusColor,
  getStatusLabel,
  onAts,
  onInterview,
}: {
  app: DemoApplication;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  getStatusColor: (s: DemoApplication['status']) => string;
  getStatusLabel: (s: DemoApplication['status']) => string;
  onAts: () => void;
  onInterview: () => void;
}) {
  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.03 }}
        className="cursor-pointer border-b transition-colors hover:bg-[rgba(255,255,255,0.25)]"
        style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}
        onClick={onToggle}
      >
        <td className="p-4" style={{ fontWeight: 800 }}>
          {app.company}
        </td>
        <td className="p-4" style={{ fontWeight: 200 }}>
          {app.role}
        </td>
        <td className="mono p-4 text-sm" style={{ fontWeight: 200 }}>
          {app.date}
        </td>
        <td className="p-4">
          <span
            className="rounded-full px-2 py-1 text-xs"
            style={{
              background: app.method === 'ATS' ? 'rgba(0, 102, 255, 0.1)' : 'rgba(90, 200, 250, 0.1)',
              color: app.method === 'ATS' ? '#0066FF' : '#5AC8FA',
              fontWeight: 800,
            }}
          >
            {app.method}
          </span>
        </td>
        <td className="mono p-4" style={{ color: app.fitScore >= 85 ? '#00B341' : '#F5A623', fontWeight: 400 }}>
          {app.fitScore}
        </td>
        <td className="p-4">
          {app.atsScore > 0 ? (
            <button
              type="button"
              className="mono underline"
              style={{
                color: app.atsScore >= 80 ? '#00B341' : app.atsScore >= 60 ? '#F5A623' : '#FF3B30',
                fontWeight: 400,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAts();
              }}
            >
              {app.atsScore}
            </button>
          ) : (
            <span className="mono text-[#9B9B9B]" style={{ fontWeight: 400 }}>
              —
            </span>
          )}
        </td>
        <td className="p-4">
          <span
            className={`rounded-full px-3 py-1 text-xs ${
              app.status === 'waiting' || app.status === 'applied' ? 'status-pill-pulse' : ''
            }`}
            style={{
              background: `${getStatusColor(app.status)}20`,
              color: getStatusColor(app.status),
              fontWeight: 800,
            }}
          >
            {getStatusLabel(app.status)}
          </span>
        </td>
        <td className="p-4 text-sm" style={{ fontWeight: 200 }}>
          {app.response ?? '—'}
        </td>
        <td className="mono p-4 text-sm" style={{ fontWeight: 200 }}>
          {app.daysWaiting}
        </td>
        <td className="p-4">
          {app.nextAction && (
            <button
              type="button"
              className="btn-micro rounded-[var(--radius-lg)] px-3 py-1 text-xs glass-nested"
              style={{ color: '#0066FF' }}
              onClick={(e) => {
                e.stopPropagation();
                if (app.status === 'interview') onInterview();
              }}
            >
              {app.nextAction}
            </button>
          )}
        </td>
      </motion.tr>
      {expanded && (
        <tr className="bg-[rgba(255,255,255,0.15)]">
          <td colSpan={10} className="p-6">
            <DetailPanel app={app} onInterview={onInterview} />
          </td>
        </tr>
      )}
    </>
  );
}

function DetailPanel({
  app,
  onInterview,
}: {
  app: DemoApplication;
  onInterview: () => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2" onClick={(e) => e.stopPropagation()}>
      <div className="glass-nested rounded-[var(--radius-xl)] p-4">
        <h4 className="mb-2" style={{ fontWeight: 800 }}>
          Generated resume
        </h4>
        <p className="mono text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
          resume_{app.company.toLowerCase()}.pdf
        </p>
        <button type="button" className="btn-micro mt-2 text-sm underline" style={{ color: '#0066FF' }}>
          Open preview
        </button>
      </div>
      <div className="glass-nested rounded-[var(--radius-xl)] p-4">
        <h4 className="mb-2" style={{ fontWeight: 800 }}>
          Cover letter
        </h4>
        <p style={{ fontWeight: 200, fontSize: '0.875rem' }}>Tailored intro + role alignment paragraph.</p>
      </div>
      <div className="glass-nested rounded-[var(--radius-xl)] p-4">
        <h4 className="mb-2" style={{ fontWeight: 800 }}>
          ATS breakdown
        </h4>
        <p className="text-sm" style={{ fontWeight: 200 }}>
          Matched: {(app.matchedKeywords ?? []).join(', ') || '—'}
        </p>
        <p className="text-sm" style={{ fontWeight: 200 }}>
          Missing: {(app.missingKeywords ?? []).join(', ') || '—'}
        </p>
      </div>
      <div className="glass-nested rounded-[var(--radius-xl)] p-4">
        <h4 className="mb-2" style={{ fontWeight: 800 }}>
          Submission screenshot
        </h4>
        <p className="mono text-xs" style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
          screenshot_{app.id}.png
        </p>
      </div>
      <div className="glass-nested rounded-[var(--radius-xl)] p-4">
        <h4 className="mb-2" style={{ fontWeight: 800 }}>
          Email thread
        </h4>
        <p style={{ fontWeight: 200, fontSize: '0.875rem' }}>
          {app.method === 'Email' ? 'Thread stub: acknowledgement received.' : 'N/A (ATS portal)'}
        </p>
      </div>
      <div className="glass-nested rounded-[var(--radius-xl)] p-4">
        <h4 className="mb-2" style={{ fontWeight: 800 }}>
          Interview details
        </h4>
        {app.status === 'interview' ? (
          <button
            type="button"
            className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 text-white"
            style={{ background: '#0066FF' }}
            onClick={onInterview}
          >
            Open interview view
          </button>
        ) : (
          <p style={{ fontWeight: 200, fontSize: '0.875rem' }}>No interview scheduled.</p>
        )}
      </div>
      <div className="glass-nested rounded-[var(--radius-xl)] p-4 md:col-span-2">
        <h4 className="mb-2" style={{ fontWeight: 800 }}>
          Thank-you / follow-up
        </h4>
        <p style={{ fontWeight: 200, fontSize: '0.875rem' }}>
          Thank-you: {app.thankYouStatus ?? 'n/a'} · Follow-up: {app.followUpStatus ?? 'n/a'}
        </p>
      </div>
      <div className="glass-nested rounded-[var(--radius-xl)] p-4 md:col-span-2">
        <label className="mb-2 block" style={{ fontWeight: 200 }}>
          User notes
        </label>
        <textarea
          className="min-h-[80px] w-full rounded-[var(--radius-md)] glass-nested border-0 p-3"
          style={{ fontWeight: 200 }}
          placeholder="Private notes…"
        />
      </div>
    </div>
  );
}
