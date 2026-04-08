import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ArrowRight, FileText, List, Settings } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { demoApplications, demoFeedEvents, demoUpNextJobs, type DemoFeedEvent } from '../../data/demoData';
import { useDashboardContext } from '../Dashboard';
import type { DashboardPage } from './MobileNav';

const attentionStatuses: DemoFeedEvent['status'][] = ['captcha', 'interview', 'failed'];

function eventAccent(status: DemoFeedEvent['status']) {
  switch (status) {
    case 'interview':
      return '#00B341';
    case 'captcha':
      return '#F5A623';
    case 'failed':
      return '#FF3B30';
    default:
      return '#6B6B6B';
  }
}

function tileMotion(delay: number) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const, delay },
  };
}

export default function HomeDashboard({ onNavigate }: { onNavigate: (page: DashboardPage) => void }) {
  const { openAts, openInterview } = useModals();
  const { demoMode } = useDashboardContext();

  const recentEvents = useMemo(() => demoFeedEvents.slice(0, 4), []);
  const attentionEvents = useMemo(
    () => demoFeedEvents.filter((e) => attentionStatuses.includes(e.status)),
    [],
  );
  const upNextPreview = useMemo(() => demoUpNextJobs.slice(0, 3), []);

  const pipelineStats = useMemo(() => {
    if (!demoMode) {
      return [
        { label: 'Applied', value: '0', color: '#0066FF' },
        { label: 'Waiting', value: '0', color: '#F5A623' },
        { label: 'Interviews', value: '0', color: '#00B341' },
        { label: 'Offers', value: '0', color: '#00B341' },
      ];
    }
    const applied = demoApplications.filter((a) => a.status !== 'manual_needed').length;
    const waiting = demoApplications.filter((a) => a.status === 'waiting' || a.status === 'applied').length;
    const interviews = demoApplications.filter((a) => a.status === 'interview').length;
    const offers = demoApplications.filter((a) => a.status === 'offer').length;
    return [
      { label: 'Applied', value: String(applied), color: '#0066FF' },
      { label: 'Waiting', value: String(waiting), color: '#F5A623' },
      { label: 'Interviews', value: String(interviews), color: '#00B341' },
      { label: 'Offers', value: String(offers), color: '#00B341' },
    ];
  }, [demoMode]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 text-center">
        <h1 style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>Home</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]" style={{ fontWeight: 200 }}>
          Pipeline snapshot and what to do next.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <motion.section
          {...tileMotion(0)}
          className="glass-panel p-6 lg:col-span-8"
        >
          <h2 className="mb-4 text-sm" style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>
            Pipeline overview
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {pipelineStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[var(--radius-lg)] glass-nested px-4 py-4 text-center md:text-left"
              >
                <div
                  className="mono mb-1 text-2xl tabular-nums md:text-3xl"
                  style={{ color: stat.color, fontWeight: 900 }}
                >
                  {stat.value}
                </div>
                <div className="text-xs text-[var(--text-secondary)]" style={{ fontWeight: 200 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          {...tileMotion(0.06)}
          className="glass-panel flex flex-col p-6 lg:col-span-4"
        >
          <h2 className="mb-4 text-sm" style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>
            Needs attention
          </h2>
          {attentionEvents.length === 0 ? (
            <p className="flex flex-1 items-center text-sm text-[var(--text-secondary)]" style={{ fontWeight: 200 }}>
              Nothing needs your attention right now.
            </p>
          ) : (
            <ul className="flex flex-1 flex-col gap-3">
              {attentionEvents.map((event) => {
                const accent = eventAccent(event.status);
                return (
                  <li
                    key={event.id}
                    className="rounded-[var(--radius-lg)] glass-nested p-3"
                    style={{ borderLeft: `3px solid ${accent}` }}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span style={{ fontWeight: 800 }} className="text-sm">
                        {event.company}
                      </span>
                      <span className="mono text-[0.65rem] text-[#9B9B9B]" style={{ fontWeight: 400 }}>
                        {event.timestamp}
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-[#6B6B6B]" style={{ fontWeight: 200 }}>
                      {event.action}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {event.status === 'interview' && (
                        <button
                          type="button"
                          className="btn-micro rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-white"
                          style={{ background: '#0066FF' }}
                          onClick={() => openInterview({ company: event.company, role: event.role })}
                        >
                          Respond
                        </button>
                      )}
                      {event.status === 'failed' && (
                        <button
                          type="button"
                          className="btn-micro rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-white"
                          style={{ background: '#FF3B30' }}
                        >
                          Complete manually
                        </button>
                      )}
                      {event.status === 'captcha' && (
                        <button
                          type="button"
                          className="btn-micro rounded-[var(--radius-md)] px-3 py-1.5 text-xs glass-nested"
                          onClick={() => onNavigate('feed')}
                        >
                          View in activity
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.section>

        <motion.section
          {...tileMotion(0.12)}
          className="glass-panel p-6 lg:col-span-6"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm" style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              Up next
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('jobs')}
              className="btn-micro mono flex items-center gap-1 text-xs"
              style={{ fontWeight: 400, color: '#0066FF' }}
            >
              Jobs board
              <ArrowRight className="size-3.5" />
            </button>
          </div>
          <ul className="space-y-3">
            {upNextPreview.map((job, i) => (
              <li key={`${job.company}-${i}`} className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] glass-nested px-4 py-3">
                <div className="min-w-0">
                  <div style={{ fontWeight: 800 }} className="truncate text-sm">
                    {job.company}
                  </div>
                  <div style={{ fontWeight: 200 }} className="truncate text-xs text-[#6B6B6B]">
                    {job.role}
                  </div>
                </div>
                <span
                  className="mono shrink-0 text-sm tabular-nums"
                  style={{ color: job.score >= 85 ? '#00B341' : '#F5A623', fontWeight: 400 }}
                >
                  {job.score}
                </span>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          {...tileMotion(0.18)}
          className="glass-panel p-6 lg:col-span-6"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm" style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              Recent activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('feed')}
              className="btn-micro mono flex items-center gap-1 text-xs"
              style={{ fontWeight: 400, color: '#0066FF' }}
            >
              View all
              <ArrowRight className="size-3.5" />
            </button>
          </div>
          <ul className="space-y-2">
            {recentEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-start gap-3 rounded-[var(--radius-md)] border border-transparent px-2 py-2 transition-colors hover:bg-[var(--glass-nested)]"
              >
                <div
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{ background: eventAccent(event.status) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <span className="text-sm" style={{ fontWeight: 800 }}>
                      {event.company}
                    </span>
                    <span className="text-xs text-[#6B6B6B]" style={{ fontWeight: 200 }}>
                      {event.role}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]" style={{ fontWeight: 200 }}>
                    {event.action}
                  </p>
                  {event.score != null && (
                    <button
                      type="button"
                      className="mono mt-1 text-xs underline"
                      style={{ fontWeight: 400, color: '#0066FF' }}
                      onClick={() => openAts({ score: event.score! })}
                    >
                      ATS {event.score}%
                    </button>
                  )}
                </div>
                <span className="mono shrink-0 text-[0.65rem] text-[#9B9B9B]" style={{ fontWeight: 400 }}>
                  {event.timestamp}
                </span>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section {...tileMotion(0.24)} className="lg:col-span-4">
          <button
            type="button"
            onClick={() => onNavigate('applications')}
            className="glass-panel btn-micro flex h-full min-h-[120px] w-full flex-col items-start justify-between p-6 text-left transition-transform hover:scale-[1.01]"
          >
            <List className="size-6 text-[var(--text-secondary)]" strokeWidth={1.5} />
            <div>
              <div style={{ fontWeight: 800 }} className="text-sm">
                Applications
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]" style={{ fontWeight: 200 }}>
                Track status and follow-ups
              </p>
            </div>
          </button>
        </motion.section>

        <motion.section {...tileMotion(0.28)} className="lg:col-span-4">
          <button
            type="button"
            onClick={() => onNavigate('resumes')}
            className="glass-panel btn-micro flex h-full min-h-[120px] w-full flex-col items-start justify-between p-6 text-left transition-transform hover:scale-[1.01]"
          >
            <FileText className="size-6 text-[var(--text-secondary)]" strokeWidth={1.5} />
            <div>
              <div style={{ fontWeight: 800 }} className="text-sm">
                Resume vault
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]" style={{ fontWeight: 200 }}>
                Versions and ATS scores
              </p>
            </div>
          </button>
        </motion.section>

        <motion.section {...tileMotion(0.32)} className="lg:col-span-4">
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="glass-panel btn-micro flex h-full min-h-[120px] w-full flex-col items-start justify-between p-6 text-left transition-transform hover:scale-[1.01]"
          >
            <Settings className="size-6 text-[var(--text-secondary)]" strokeWidth={1.5} />
            <div>
              <div style={{ fontWeight: 800 }} className="text-sm">
                Settings
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]" style={{ fontWeight: 200 }}>
                Account and preferences
              </p>
            </div>
          </button>
        </motion.section>
      </div>
    </div>
  );
}
