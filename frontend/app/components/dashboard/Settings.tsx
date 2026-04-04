import { motion } from 'motion/react';
import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown, Linkedin, Table } from 'lucide-react';
import { useDashboardContext } from '../Dashboard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Switch as UiSwitch } from '../ui/switch';

const demoParsedCvSections: { title: string; body: string }[] = [
  {
    title: 'Education',
    body: 'Carnegie Mellon University — B.S. Computer Science (expected 2028). Coursework: algorithms, systems, ML.',
  },
  {
    title: 'Experience',
    body: 'Software Engineering Intern, Stripe (Summer 2025) — internal tooling and API reliability.',
  },
  {
    title: 'Projects',
    body: 'AutoApply — React + TypeScript dashboard for job pipelines; open-source CLI utilities.',
  },
  {
    title: 'Skills',
    body: 'Python, TypeScript, React, SQL, distributed systems, testing.',
  },
  {
    title: 'Extracurriculars',
    body: 'ACM chapter workshops; peer tutoring for data structures.',
  },
  {
    title: 'Awards',
    body: "Dean's List; ICPC regional qualifier.",
  },
];

export default function Settings() {
  const { onEditParsedCv, onSignOut } = useDashboardContext();
  const [threshold, setThreshold] = useState(75);
  const [sheetsOn, setSheetsOn] = useState(true);
  const [sheetId] = useState('1AbC_dEmo_SheetId_42');
  const [calendarConnected, setCalendarConnected] = useState(false);

  const [essays, setEssays] = useState({
    technical: '',
    teamwork: '',
    challenge: '',
    motivation: '',
  });
  const limits = { technical: 500, teamwork: 400, challenge: 400, motivation: 300 } as const;
  const [parsedCvOpen, setParsedCvOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-8 text-center" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
        Settings
      </h1>

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel p-6"
        >
          <h3 className="mb-4" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
            Profile
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block" style={{ fontWeight: 200 }}>
                  Name
                </label>
                <input
                  type="text"
                  defaultValue="Alex Chen"
                  className="w-full rounded-[var(--radius-md)] px-4 py-3 glass-nested outline-none focus:ring-2 focus:ring-[#0066FF]/30"
                  style={{ fontWeight: 200 }}
                />
              </div>
              <div>
                <label className="mb-2 block" style={{ fontWeight: 200 }}>
                  Email
                </label>
                <input
                  type="email"
                  defaultValue="alex@cmu.edu"
                  className="w-full rounded-[var(--radius-md)] px-4 py-3 glass-nested outline-none focus:ring-2 focus:ring-[#0066FF]/30"
                  style={{ fontWeight: 200 }}
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block" style={{ fontWeight: 200 }}>
                Phone
              </label>
              <input
                type="tel"
                defaultValue="+1 (555) 123-4567"
                className="w-full rounded-[var(--radius-md)] px-4 py-3 glass-nested outline-none focus:ring-2 focus:ring-[#0066FF]/30"
                style={{ fontWeight: 200 }}
              />
            </div>
            <div>
              <button
                type="button"
                className="btn-micro rounded-[var(--radius-lg)] px-6 py-2.5 text-white"
                style={{ background: '#0066FF' }}
              >
                Re-upload CV
              </button>
              <p className="mt-2 text-sm" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                Last uploaded: Mar 15, 2026
              </p>
            </div>

            <Collapsible open={parsedCvOpen} onOpenChange={setParsedCvOpen}>
              <CollapsibleTrigger
                type="button"
                className="btn-micro data-[state=open]:[&_svg]:rotate-180 flex w-full items-center justify-between gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-left glass-nested"
              >
                <span style={{ fontWeight: 800 }}>Parsed CV data</span>
                <ChevronDown
                  className="size-5 shrink-0 text-[var(--text-secondary)] transition-transform duration-200"
                  strokeWidth={2}
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 space-y-4 rounded-[var(--radius-xl)] p-4 glass-nested">
                  <p className="text-xs" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                    Parsed from your last upload. Open the editor to change any section.
                  </p>
                  <div className="max-h-[min(360px,50vh)] space-y-4 overflow-y-auto pr-1">
                    {demoParsedCvSections.map(({ title, body }) => (
                      <div key={title}>
                        <div className="mb-1 text-xs" style={{ fontWeight: 800, color: 'var(--text-tertiary)' }}>
                          {title}
                        </div>
                        <p className="text-sm leading-relaxed" style={{ fontWeight: 200, color: 'var(--text-primary)' }}>
                          {body}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn-micro w-full rounded-[var(--radius-lg)] px-4 py-2.5 text-white"
                    style={{ background: '#0066FF', fontWeight: 800 }}
                    onClick={onEditParsedCv}
                  >
                    Edit parsed CV data
                  </button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="glass-panel p-6"
        >
          <h3 className="mb-4" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
            Application Preferences
          </h3>
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label style={{ fontWeight: 200 }}>Auto-apply Threshold</label>
                <span className="mono text-lg" style={{ color: '#0066FF', fontWeight: 400 }}>
                  {threshold}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full"
              />
              <p className="mt-1 text-xs" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                Only apply to jobs with fit score above this threshold
              </p>
            </div>
            <div>
              <label className="mb-2 block" style={{ fontWeight: 200 }}>
                Daily Application Limit
              </label>
              <input
                type="number"
                defaultValue={15}
                className="w-32 rounded-[var(--radius-md)] px-4 py-3 glass-nested outline-none focus:ring-2 focus:ring-[#0066FF]/30"
                style={{ fontWeight: 200 }}
              />
            </div>
            <div>
              <label className="mb-3 block" style={{ fontWeight: 200 }}>
                Resume template
              </label>
              <div className="rounded-[var(--radius-xl)] p-5 glass-nested ring-2 ring-[#0066FF]/35">
                <p className="mb-2" style={{ fontWeight: 800 }}>
                  Jake&apos;s résumé (LaTeX)
                </p>
                <p className="mb-3 text-sm leading-relaxed" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                  All generated résumés follow the LaTeX in{' '}
                  <code className="mono rounded bg-[var(--glass-nested)] px-1.5 py-0.5 text-xs">templates/template.tex</code>
                  : Jake Gutierrez&apos;s MIT-licensed template (based on{' '}
                  <a
                    href="https://github.com/sb2nov/resume"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    style={{ fontWeight: 800, color: '#0066FF' }}
                  >
                    sb2nov/resume
                  </a>
                  ). Letter-size article, ragged right, small caps section titles with rules, and the usual{' '}
                  <span className="mono text-xs">{'\\resumeSubheading'}</span> /{' '}
                  <span className="mono text-xs">{'\\resumeItem'}</span> structure.
                </p>
                <p className="text-xs leading-relaxed" style={{ fontWeight: 200, color: 'var(--text-tertiary)' }}>
                  Sections match the file: Education, Experience, Projects, Technical Skills — with PDF Unicode mapping for
                  ATS-friendly output.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="glass-panel p-6"
        >
          <h3 className="mb-2" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
            Essay Bank
          </h3>
          <p className="mb-4 text-sm" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
            These are used as raw material for custom application questions
          </p>
          <div className="space-y-4">
            {(
              [
                { key: 'technical' as const, label: 'Technical Project' },
                { key: 'teamwork' as const, label: 'Teamwork Experience' },
                { key: 'challenge' as const, label: 'Challenge Overcome' },
                { key: 'motivation' as const, label: 'Motivation' },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between">
                  <label style={{ fontWeight: 200 }}>{label}</label>
                  <span className="mono text-xs text-[#6B6B6B]" style={{ fontWeight: 400 }}>
                    {essays[key].length} / {limits[key]}
                  </span>
                </div>
                <textarea
                  value={essays[key]}
                  onChange={(e) =>
                    setEssays((s) => ({
                      ...s,
                      [key]: e.target.value.slice(0, limits[key]),
                    }))
                  }
                  rows={3}
                  placeholder="Write your answer…"
                  className="w-full resize-none rounded-[var(--radius-md)] px-4 py-3 glass-nested outline-none focus:ring-2 focus:ring-[#0066FF]/30"
                  style={{ fontWeight: 200 }}
                />
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className="glass-panel p-6"
        >
          <h3 className="mb-4" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
            Integrations
          </h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] p-4 glass-nested sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Table className="size-8 text-[#0066FF]" strokeWidth={1.5} />
                <div>
                  <div style={{ fontWeight: 800 }}>Google Sheets</div>
                  <div className="text-xs" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                    Sync applications to spreadsheet
                  </div>
                  {sheetsOn && (
                    <p className="mono mt-1 text-xs" style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
                      Sheet ID: {sheetId}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <UiSwitch checked={sheetsOn} onCheckedChange={setSheetsOn} />
                <button
                  type="button"
                  className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 glass-nested"
                  style={{ fontWeight: 800 }}
                >
                  Force Sync
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] p-4 glass-nested sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CalendarIcon className="size-8 text-[#00B341]" strokeWidth={1.5} />
                <div>
                  <div style={{ fontWeight: 800 }}>Google Calendar</div>
                  <div className="text-xs" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                    Status: {calendarConnected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 glass-nested"
                style={{ fontWeight: 800 }}
                onClick={() => setCalendarConnected((c) => !c)}
              >
                {calendarConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
            <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] p-4 glass-nested sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Linkedin className="size-8 text-[#0066FF]" strokeWidth={1.5} />
                <div>
                  <div style={{ fontWeight: 800 }}>LinkedIn Connections</div>
                  <div className="text-xs" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                    142 connections loaded
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 glass-nested"
                style={{ fontWeight: 800 }}
              >
                Update CSV
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
          className="glass-panel p-6"
        >
          <h3 className="mb-4" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
            Account
          </h3>
          <div className="space-y-3">
            <button
              type="button"
              className="btn-micro w-full rounded-[var(--radius-lg)] px-4 py-3 text-left glass-nested"
            >
              Change Password
            </button>
            <button
              type="button"
              className="btn-micro w-full rounded-[var(--radius-lg)] px-4 py-3 text-left glass-nested"
              style={{ color: '#FF3B30' }}
            >
              Delete Account
            </button>
            <button
              type="button"
              className="btn-micro w-full rounded-[var(--radius-lg)] px-4 py-3 text-white"
              style={{ background: '#6B6B6B' }}
              onClick={onSignOut}
            >
              Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
