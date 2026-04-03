import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { MapPin, UserRoundSearch } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useModals } from '../../context/ModalContext';
import { demoJobs, type DemoJob } from '../../data/demoData';
import { useDashboardContext } from '../Dashboard';

export default function JobsBoard() {
  const { demoMode } = useDashboardContext();
  const { openReferral, openAts } = useModals();
  const [hideGhost, setHideGhost] = useState(false);
  const [hasReferralOnly, setHasReferralOnly] = useState(false);
  const [minFitScore, setMinFitScore] = useState(0);
  const [competition, setCompetition] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [forceEmpty, setForceEmpty] = useState(false);

  const jobs = forceEmpty ? [] : demoJobs;

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (hideGhost && job.isGhost) return false;
      if (hasReferralOnly && !job.hasReferral) return false;
      if (job.fitScore < minFitScore) return false;
      if (competition !== 'All' && job.competition !== competition) return false;
      return true;
    });
  }, [jobs, hideGhost, hasReferralOnly, minFitScore, competition]);

  const getCompetitionColor = (level: string) => {
    switch (level) {
      case 'High':
        return '#FF3B30';
      case 'Medium':
        return '#F5A623';
      case 'Low':
        return '#00B341';
      default:
        return '#6B6B6B';
    }
  };

  const getFitScoreColor = (score: number) => {
    if (score >= 80) return '#00B341';
    if (score >= 60) return '#F5A623';
    return '#FF3B30';
  };

  if (jobs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-center" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
          Jobs Board
        </h1>
        <div className="glass-panel p-10 text-center">
          <p className="mono mb-4 text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
            No jobs scraped yet. The scraper runs every 2 hours.
          </p>
          <p style={{ fontWeight: 200, color: 'var(--text-tertiary)' }}>Check back soon</p>
          {demoMode && forceEmpty && (
            <button
              type="button"
              className="btn-micro mt-6 rounded-[var(--radius-lg)] px-6 py-2 glass-nested"
              onClick={() => setForceEmpty(false)}
            >
              Restore jobs
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <div className="mb-6 text-center">
          <h1 style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>Jobs Board</h1>
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

        <div className="glass-panel p-6">
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm" style={{ fontWeight: 200 }}>
                Source
              </label>
              <select className="w-full rounded-[var(--radius-md)] px-4 py-2 glass-nested" style={{ fontWeight: 200 }}>
                <option>All Sources</option>
                <option>Simplify</option>
                <option>PittCSC</option>
                <option>Apollo</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm" style={{ fontWeight: 200 }}>
                Location
              </label>
              <select className="w-full rounded-[var(--radius-md)] px-4 py-2 glass-nested" style={{ fontWeight: 200 }}>
                <option>All Locations</option>
                <option>Remote</option>
                <option>San Francisco, CA</option>
                <option>New York, NY</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm" style={{ fontWeight: 200 }}>
                Competition
              </label>
              <select
                className="w-full rounded-[var(--radius-md)] px-4 py-2 glass-nested"
                style={{ fontWeight: 200 }}
                value={competition}
                onChange={(e) => setCompetition(e.target.value as typeof competition)}
              >
                <option value="All">All</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm" style={{ fontWeight: 200 }}>
                Min Fit Score: {minFitScore}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={minFitScore}
                onChange={(e) => setMinFitScore(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm" style={{ fontWeight: 200 }}>
                Sort By
              </label>
              <select className="w-full rounded-[var(--radius-md)] px-4 py-2 glass-nested" style={{ fontWeight: 200 }}>
                <option>Fit Score (High to Low)</option>
                <option>Date Posted</option>
                <option>Competition (Low to High)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={hideGhost}
                onChange={(e) => setHideGhost(e.target.checked)}
                className="size-4"
              />
              <span style={{ fontWeight: 200 }} className="text-sm">
                Hide Ghost Jobs
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={hasReferralOnly}
                onChange={(e) => setHasReferralOnly(e.target.checked)}
                className="size-4"
              />
              <span style={{ fontWeight: 200 }} className="text-sm">
                Has Referral
              </span>
            </label>
          </div>

          <div className="mono mt-4 text-sm text-[#6B6B6B]" style={{ fontWeight: 400 }}>
            {filteredJobs.length} jobs matched
          </div>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <p className="mono text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
            No jobs match your filters. Adjust filters to see more roles.
          </p>
        </div>
      ) : (
        <div className="columns-1 gap-6 space-y-6 md:columns-2 xl:columns-3">
          {filteredJobs.map((job, i) => (
            <JobCard
              key={job.id}
              job={job}
              index={i}
              expanded={expandedJob === job.id}
              onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              getCompetitionColor={getCompetitionColor}
              getFitScoreColor={getFitScoreColor}
              onReferral={() =>
                openReferral({
                  company: job.company,
                  draftMessage: `Hi — I found a referral path into ${job.company}. Could you help?`,
                })
              }
              onAts={() => openAts({ score: job.fitScore })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  index,
  expanded,
  onToggle,
  getCompetitionColor,
  getFitScoreColor,
  onReferral,
  onAts,
}: {
  job: DemoJob;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  getCompetitionColor: (l: string) => string;
  getFitScoreColor: (s: number) => string;
  onReferral: () => void;
  onAts: () => void;
}) {
  const ghostReason = job.ghostReason ?? '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
      className={`glass-panel relative mb-6 break-inside-avoid cursor-pointer p-6 transition-transform hover:scale-[1.01] ${
        job.isGhost ? 'opacity-80' : ''
      }`}
      style={{
        background: job.isGhost ? 'rgba(255, 59, 48, 0.04)' : undefined,
        borderColor: job.isGhost ? 'rgba(255, 59, 48, 0.25)' : undefined,
      }}
      onClick={onToggle}
    >
      {job.urgent && (
        <div
          className="absolute top-0 right-0 left-0 rounded-t-[var(--radius-2xl)] px-4 py-2 text-center text-xs"
          style={{ background: '#F5A623', color: 'white', fontWeight: 800 }}
        >
          Closes in ~{job.daysLeft} days
        </div>
      )}

      <div className={job.urgent ? 'mt-8' : ''}>
        <div className="mb-3">
          <h3 className={`mb-1 text-xl ${job.isGhost ? 'line-through' : ''}`} style={{ fontWeight: 800 }}>
            {job.company}
          </h3>
          <div style={{ fontWeight: 200 }} className="text-[#6B6B6B]">
            {job.role}
          </div>
        </div>

        <div className="mb-4 flex items-center gap-1.5 text-sm text-[#6B6B6B]" style={{ fontWeight: 200 }}>
          <MapPin className="size-4 shrink-0" strokeWidth={1.5} />
          {job.location}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span
            className="rounded-full px-2 py-1 text-xs"
            style={{ background: 'rgba(0, 102, 255, 0.1)', color: '#0066FF', fontWeight: 800 }}
          >
            {job.source}
          </span>
          <span
            className="rounded-full px-2 py-1 text-xs"
            style={{
              background: `${getCompetitionColor(job.competition)}20`,
              color: getCompetitionColor(job.competition),
              fontWeight: 800,
            }}
          >
            {job.competition} Competition
          </span>
          {job.hasReferral && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs"
              style={{ background: 'rgba(90, 200, 250, 0.12)', color: '#5AC8FA', fontWeight: 800 }}
              onClick={(e) => {
                e.stopPropagation();
                onReferral();
              }}
            >
              <UserRoundSearch className="size-3.5" />
              You know someone here
            </button>
          )}
          {job.isGhost && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="cursor-help rounded-full px-2 py-1 text-xs"
                  style={{ background: 'rgba(255, 59, 48, 0.1)', color: '#FF3B30', fontWeight: 800 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Likely Ghost
                </span>
              </TooltipTrigger>
              <TooltipContent className="glass-panel max-w-xs border-0 text-sm" sideOffset={6}>
                {ghostReason}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <span style={{ fontWeight: 200 }} className="text-sm">
              Fit Score
            </span>
            <button
              type="button"
              className="mono text-2xl tabular-nums"
              style={{ color: getFitScoreColor(job.fitScore), fontWeight: 900 }}
              onClick={(e) => {
                e.stopPropagation();
                onAts();
              }}
            >
              {job.fitScore}
            </button>
          </div>
          <div className="glass-nested h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{ width: `${job.fitScore}%`, background: getFitScoreColor(job.fitScore) }}
            />
          </div>
        </div>

        <div className="mb-4">
          <span
            className="rounded-full px-3 py-1 text-xs"
            style={{
              background:
                job.status === 'applied'
                  ? 'rgba(0, 102, 255, 0.1)'
                  : job.status === 'queued'
                    ? 'rgba(245, 166, 35, 0.1)'
                    : job.status === 'skipped'
                      ? 'rgba(155, 155, 155, 0.1)'
                      : 'transparent',
              color:
                job.status === 'applied'
                  ? '#0066FF'
                  : job.status === 'queued'
                    ? '#F5A623'
                    : job.status === 'skipped'
                      ? '#9B9B9B'
                      : '#6B6B6B',
              fontWeight: 800,
            }}
          >
            {job.status === 'not_applied'
              ? 'Not Applied'
              : job.status === 'queued'
                ? 'Queued'
                : job.status === 'applied'
                  ? 'Applied'
                  : 'Skipped'}
          </span>
        </div>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 border-t pt-4"
            style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontWeight: 800, marginBottom: 8 }}>Description</p>
            <p className="mb-3 text-sm" style={{ fontWeight: 200 }}>
              {job.description}
            </p>
            <p style={{ fontWeight: 800, marginBottom: 8 }}>Requirements</p>
            <p className="mb-3 text-sm" style={{ fontWeight: 200 }}>
              {job.requirements}
            </p>
            <p style={{ fontWeight: 800, marginBottom: 8 }}>Match reasoning</p>
            <p className="text-sm" style={{ fontWeight: 200 }}>
              {job.matchReasoning}
            </p>
            {job.isGhost && ghostReason && (
              <p className="mt-3 text-sm text-[#FF3B30]" style={{ fontWeight: 200 }}>
                {ghostReason}
              </p>
            )}
          </motion.div>
        )}

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {job.status === 'not_applied' && !job.isGhost && (
            <>
              <button
                type="button"
                className="btn-micro flex-1 rounded-[var(--radius-lg)] py-2 text-white"
                style={{ background: '#0066FF' }}
              >
                Apply
              </button>
              <button type="button" className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 glass-nested">
                Skip
              </button>
            </>
          )}
          {job.status === 'queued' && (
            <button type="button" className="btn-micro w-full rounded-[var(--radius-lg)] py-2 glass-nested">
              In Queue
            </button>
          )}
          {job.status === 'applied' && (
            <button type="button" className="btn-micro w-full rounded-[var(--radius-lg)] py-2 glass-nested">
              View Application
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
