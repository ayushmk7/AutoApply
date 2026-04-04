import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { CheckCircle2, CircleDot } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { demoFeedEvents, demoUpNextJobs, type DemoFeedEvent } from '../../data/demoData';
import { useDashboardContext } from '../Dashboard';
import ApiLiveFeedPanel from './ApiLiveFeedPanel';

function getEventStyle(status: DemoFeedEvent['status']) {
  switch (status) {
    case 'generating':
      return {
        bg: 'rgba(0, 102, 255, 0.04)',
        border: 'rgba(0, 102, 255, 0.2)',
        color: '#0066FF',
        pulse: true,
      };
    case 'ats':
      return { bg: 'rgba(0, 179, 65, 0.04)', border: 'rgba(0, 179, 65, 0.2)', color: '#00B341', pulse: false };
    case 'submitted':
      return { bg: 'rgba(0, 102, 255, 0.04)', border: 'rgba(0, 102, 255, 0.2)', color: '#0066FF', pulse: false };
    case 'interview':
      return { bg: 'rgba(0, 179, 65, 0.04)', border: 'rgba(0, 179, 65, 0.2)', color: '#00B341', pulse: false };
    case 'ghost':
      return { bg: 'rgba(255, 59, 48, 0.04)', border: 'rgba(255, 59, 48, 0.2)', color: '#FF3B30', pulse: false };
    case 'failed':
      return { bg: 'rgba(255, 59, 48, 0.04)', border: 'rgba(255, 59, 48, 0.2)', color: '#FF3B30', pulse: false };
    case 'rejected':
      return { bg: 'rgba(255, 59, 48, 0.04)', border: 'rgba(255, 59, 48, 0.2)', color: '#FF3B30', pulse: false };
    case 'captcha':
      return { bg: 'rgba(245, 166, 35, 0.04)', border: 'rgba(245, 166, 35, 0.2)', color: '#F5A623', pulse: true };
    case 'referral':
      return { bg: 'rgba(90, 200, 250, 0.06)', border: 'rgba(90, 200, 250, 0.35)', color: '#5AC8FA', pulse: false };
    default:
      return {
        bg: 'rgba(255, 255, 255, 0.3)',
        border: 'rgba(255, 255, 255, 0.5)',
        color: '#6B6B6B',
        pulse: false,
      };
  }
}

function atsColor(score: number) {
  if (score >= 80) return '#00B341';
  if (score >= 60) return '#F5A623';
  return '#FF3B30';
}

export default function LiveFeed() {
  const { demoMode } = useDashboardContext();
  const { openAts, openInterview, openReferral } = useModals();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const events = useMemo(() => {
    if (showEmpty) return [];
    return demoFeedEvents;
  }, [showEmpty]);

  const showUpNext = true;

  if (events.length === 0) {
    return (
      <div className="mx-auto max-w-2xl glass-panel p-10 text-center">
        <h1
          className="mb-6"
          style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}
        >
          Activity
        </h1>
        {demoMode ? (
          <>
            <p className="mono mb-4 text-sm" style={{ fontWeight: 400 }}>
              Demo feed cleared.
            </p>
            <button
              type="button"
              className="btn-micro rounded-[var(--radius-lg)] px-6 py-3 glass-nested"
              onClick={() => setShowEmpty(false)}
            >
              Restore sample feed
            </button>
          </>
        ) : (
          <>
            <p className="mono mb-6 text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
              No activity yet. Upload your CV to get started.
            </p>
            <button
              type="button"
              className="btn-micro rounded-[var(--radius-lg)] px-6 py-3 text-white"
              style={{ background: '#0066FF' }}
            >
              Upload CV
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {!demoMode && <ApiLiveFeedPanel />}
      <div className="mb-8 flex items-center justify-center gap-3">
        <h1 style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>Activity</h1>
        <div className="size-2.5 animate-pulse rounded-full bg-[#00B341]" title="System active" />
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${showUpNext ? 'min-[1440px]:grid-cols-3' : ''}`}
      >
        <div className={showUpNext ? 'min-[1440px]:col-span-2' : ''}>
          <div className="space-y-3">
            {events.map((event, i) => {
              const style = getEventStyle(event.status);
              const isExpanded = expandedEvent === event.id;

              return (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: -24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: Math.min(i * 0.04, 0.4) }}
                  className={`feed-card-enter glass-panel cursor-pointer p-5 transition-transform hover:scale-[1.005] ${
                    style.pulse ? 'animate-pulse' : ''
                  }`}
                  style={{
                    background: style.bg,
                    borderColor: style.border,
                    borderWidth: 1,
                    borderStyle: 'solid',
                  }}
                  onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="order-2 flex-1 sm:order-1">
                      <span className="mono mb-2 block text-xs text-[#9B9B9B]" style={{ fontWeight: 400 }}>
                        {event.timestamp}
                      </span>
                      <div className="mb-1 flex flex-wrap items-baseline gap-2">
                        <span style={{ fontWeight: 800 }} className="text-lg">
                          {event.status === 'ghost' ? (
                            <span className="line-through opacity-60">{event.company}</span>
                          ) : (
                            event.company
                          )}
                        </span>
                        <span style={{ fontWeight: 200 }} className="text-sm text-[#6B6B6B]">
                          {event.role}
                        </span>
                      </div>
                      <div style={{ fontWeight: 200 }} className="text-[#6B6B6B]">
                        {event.action}
                      </div>

                      {event.score != null && (
                        <button
                          type="button"
                          className="mono mt-3 block text-4xl tabular-nums transition-opacity hover:opacity-80"
                          style={{ color: atsColor(event.score), fontWeight: 900 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openAts({ score: event.score! });
                          }}
                        >
                          {event.score}%
                        </button>
                      )}

                      {event.status === 'submitted' && (
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="mt-2 inline-flex items-center gap-2 text-[#00B341]"
                        >
                          <CheckCircle2 className="size-5" strokeWidth={2} />
                          <span style={{ fontWeight: 200 }}>Submitted</span>
                        </motion.div>
                      )}

                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 border-t pt-4"
                          style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {event.resumeSnippet && (
                            <p className="mb-2 text-sm" style={{ fontWeight: 200 }}>
                              <span style={{ fontWeight: 800 }}>Resume: </span>
                              {event.resumeSnippet}
                            </p>
                          )}
                          {event.coverSnippet && (
                            <p className="mb-2 text-sm" style={{ fontWeight: 200 }}>
                              <span style={{ fontWeight: 800 }}>Cover: </span>
                              {event.coverSnippet}
                            </p>
                          )}
                          {event.score != null && (
                            <button
                              type="button"
                              className="mono mb-2 text-sm underline"
                              style={{ color: '#0066FF', fontWeight: 400 }}
                              onClick={() => openAts({ score: event.score! })}
                            >
                              Open ATS breakdown
                            </button>
                          )}
                          {event.screenshotLabel && (
                            <p className="mono text-xs text-[#9B9B9B]" style={{ fontWeight: 400 }}>
                              Screenshot: {event.screenshotLabel}
                            </p>
                          )}
                          {event.details && !event.resumeSnippet && (
                            <p style={{ fontWeight: 200 }} className="text-sm">
                              {event.details}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            {event.status === 'interview' && (
                              <button
                                type="button"
                                className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 text-white"
                                style={{ background: '#0066FF' }}
                                onClick={() => openInterview({ company: event.company, role: event.role })}
                              >
                                Respond
                              </button>
                            )}
                            {event.status === 'failed' && (
                              <button
                                type="button"
                                className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 text-white"
                                style={{ background: '#FF3B30' }}
                              >
                                Complete Manually
                              </button>
                            )}
                            {event.status === 'referral' && (
                              <button
                                type="button"
                                className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 text-white"
                                style={{ background: '#5AC8FA', color: '#1A1A1A' }}
                                onClick={() =>
                                  openReferral({
                                    company: event.company,
                                    draftMessage: `Hi — I am applying to ${event.role} at ${event.company}. Would you refer me?`,
                                  })
                                }
                              >
                                Referral details
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <div className="order-1 flex flex-row items-center gap-2 sm:order-2 sm:flex-col sm:items-end">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                        style={{
                          background: `${style.color}18`,
                          color: style.color,
                          fontWeight: 800,
                        }}
                      >
                        <CircleDot className="size-3" />
                        {event.status}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {demoMode && (
            <button
              type="button"
              className="mono mt-6 text-xs underline"
              style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}
              onClick={() => setShowEmpty(true)}
            >
              Clear demo feed (test empty state)
            </button>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="glass-panel hidden h-fit p-6 min-[1440px]:block"
        >
          <h3 className="mb-4" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
            Up Next
          </h3>
          <div className="space-y-3">
            {demoUpNextJobs.map((job, i) => (
              <div key={`${job.company}-${i}`} className="glass-nested p-3">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <div style={{ fontWeight: 800 }} className="text-sm">
                      {job.company}
                    </div>
                    <div style={{ fontWeight: 200 }} className="text-xs text-[#6B6B6B]">
                      {job.role}
                    </div>
                  </div>
                  <div
                    className="mono text-sm tabular-nums"
                    style={{ color: job.score >= 85 ? '#00B341' : '#F5A623', fontWeight: 400 }}
                  >
                    {job.score}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-micro w-full rounded-[var(--radius-lg)] py-1.5 text-xs glass-nested"
                >
                  Skip
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
