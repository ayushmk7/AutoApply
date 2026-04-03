import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Calendar } from './ui/calendar';

const STEPS = ['Upload CV', 'Review', 'Questionnaire', 'Preferences', 'Confirm'] as const;

export default function OnboardingFlow({
  onComplete,
  initialStep = 1,
}: {
  onComplete: () => void;
  initialStep?: number;
}) {
  const [step, setStep] = useState(() => Math.min(5, Math.max(1, initialStep)));
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [authUs, setAuthUs] = useState('authorized');
  const [demoDecline, setDemoDecline] = useState(false);
  const [essayTech, setEssayTech] = useState('');
  const [essayTeam, setEssayTeam] = useState('');
  const [essayChallenge, setEssayChallenge] = useState('');
  const [essayMotivation, setEssayMotivation] = useState('');
  const [fitThreshold, setFitThreshold] = useState([72]);
  const [dailyLimit, setDailyLimit] = useState(15);
  const [sheetsEnabled, setSheetsEnabled] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    setParsing(true);
    window.setTimeout(() => {
      setParsing(false);
      setStep(2);
    }, 1600);
  }, []);

  const progressPills = (
    <div className="mb-8 flex flex-wrap gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <button
            key={label}
            type="button"
            onClick={() => done && setStep(n)}
            className="rounded-full px-3 py-1.5 text-xs transition-all"
            style={{
              fontWeight: 800,
              background: active ? '#0066FF' : done ? 'rgba(0,102,255,0.15)' : 'var(--glass-nested)',
              color: active ? '#fff' : 'var(--text-primary)',
              border: '1px solid rgba(255,255,255,0.5)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel w-full max-w-3xl p-8 md:p-10"
        style={{
          boxShadow:
            '0 8px 32px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
        }}
      >
        {progressPills}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>Upload your CV</h2>
              <p style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                PDF or DOCX. We will parse education, experience, and skills.
              </p>
              <label
                className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed px-6 py-10 transition-colors glass-nested"
                style={{ borderColor: 'rgba(255,255,255,0.6)' }}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <span style={{ fontWeight: 800 }}>Drag and drop</span>
                <span className="mt-2" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                  or click to browse
                </span>
                {fileName && (
                  <span className="mono mt-4 text-sm" style={{ fontWeight: 400 }}>
                    {fileName}
                  </span>
                )}
              </label>
              {parsing && (
                <p className="mono text-center text-sm" style={{ fontWeight: 400, color: '#0066FF' }}>
                  Parsing with Claude…
                </p>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <h2 className="mb-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                Review parsed CV
              </h2>
              <Accordion type="multiple" className="glass-nested mb-6 rounded-[var(--radius-xl)] px-4">
                {['Education', 'Experience', 'Projects', 'Skills', 'Extracurriculars', 'Awards'].map(
                  (section) => (
                    <AccordionItem key={section} value={section} className="border-[rgba(255,255,255,0.4)]">
                      <AccordionTrigger style={{ fontWeight: 800 }}>{section}</AccordionTrigger>
                      <AccordionContent>
                        <Textarea
                          className="glass-nested mb-2 min-h-[80px] rounded-[var(--radius-md)] border-0"
                          style={{ fontWeight: 200 }}
                          defaultValue={`Sample ${section} content — edit as needed.`}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ),
                )}
              </Accordion>
              <button
                type="button"
                className="btn-micro rounded-[var(--radius-lg)] px-6 py-3 text-white"
                style={{ background: '#0066FF' }}
                onClick={() => setStep(3)}
              >
                Looks Good
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-8"
            >
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>Questionnaire</h2>

              <section className="glass-nested space-y-3 rounded-[var(--radius-xl)] p-5">
                <h3 style={{ fontWeight: 800 }}>Work authorization</h3>
                <label className="block text-sm" style={{ fontWeight: 200 }}>
                  Status
                </label>
                <select
                  className="w-full rounded-[var(--radius-md)] glass-nested px-4 py-3"
                  style={{ fontWeight: 200 }}
                  value={authUs}
                  onChange={(e) => setAuthUs(e.target.value)}
                >
                  <option value="authorized">US Citizen</option>
                  <option value="opt">F-1 OPT</option>
                  <option value="needs">Needs sponsorship</option>
                </select>
              </section>

              <section className="glass-nested space-y-3 rounded-[var(--radius-xl)] p-5">
                <div className="flex items-center justify-between">
                  <h3 style={{ fontWeight: 800 }}>Demographics (optional)</h3>
                  <label className="flex items-center gap-2 text-sm" style={{ fontWeight: 200 }}>
                    <input
                      type="checkbox"
                      checked={demoDecline}
                      onChange={(e) => setDemoDecline(e.target.checked)}
                    />
                    Decline
                  </label>
                </div>
                {!demoDecline && (
                  <Input
                    placeholder="How you identify (optional)"
                    className="glass-nested rounded-[var(--radius-md)] border-0"
                    style={{ fontWeight: 200 }}
                  />
                )}
              </section>

              <section className="glass-nested space-y-3 rounded-[var(--radius-xl)] p-5">
                <h3 style={{ fontWeight: 800 }}>Availability</h3>
                <div className="max-w-xs rounded-[var(--radius-md)] glass-nested p-2">
                  <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md" />
                </div>
                <label className="block text-sm" style={{ fontWeight: 200 }}>
                  Preferred locations (multi-select stub)
                </label>
                <div className="flex flex-wrap gap-2">
                  {['SF', 'NYC', 'Remote'].map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      className="rounded-[var(--radius-sm)] px-3 py-1 glass-nested"
                      style={{ fontWeight: 800, fontSize: '0.75rem' }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </section>

              <section className="glass-nested space-y-3 rounded-[var(--radius-xl)] p-5">
                <h3 style={{ fontWeight: 800 }}>Default answers</h3>
                <Input
                  placeholder="How did you hear about us?"
                  className="glass-nested rounded-[var(--radius-md)] border-0"
                  style={{ fontWeight: 200 }}
                />
                <Input
                  placeholder="Salary expectations"
                  className="glass-nested rounded-[var(--radius-md)] border-0"
                  style={{ fontWeight: 200 }}
                />
              </section>

              <section className="glass-nested space-y-4 rounded-[var(--radius-xl)] p-5">
                <h3 style={{ fontWeight: 800 }}>Essay bank</h3>
                {[
                  { label: 'Technical project', max: 500, v: essayTech, set: setEssayTech },
                  { label: 'Teamwork', max: 400, v: essayTeam, set: setEssayTeam },
                  { label: 'Challenge', max: 400, v: essayChallenge, set: setEssayChallenge },
                  { label: 'Motivation', max: 300, v: essayMotivation, set: setEssayMotivation },
                ].map((f) => (
                  <div key={f.label}>
                    <div className="mb-1 flex justify-between">
                      <label style={{ fontWeight: 200 }}>{f.label}</label>
                      <span className="mono text-xs" style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
                        {f.v.length} / {f.max}
                      </span>
                    </div>
                    <Textarea
                      value={f.v}
                      onChange={(e) => f.set(e.target.value.slice(0, f.max))}
                      rows={3}
                      className="glass-nested rounded-[var(--radius-md)] border-0"
                      style={{ fontWeight: 200 }}
                    />
                  </div>
                ))}
              </section>

              <button
                type="button"
                className="btn-micro rounded-[var(--radius-lg)] px-6 py-3 text-white"
                style={{ background: '#0066FF' }}
                onClick={() => setStep(4)}
              >
                Continue
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="s4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-8"
            >
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>Preferences</h2>
              <div>
                <p className="mb-3" style={{ fontWeight: 800 }}>
                  Resume template
                </p>
                <div className="rounded-[var(--radius-xl)] p-5 glass-nested ring-2 ring-[#0066FF]/35">
                  <p className="mb-2" style={{ fontWeight: 800 }}>
                    Jake&apos;s résumé (LaTeX)
                  </p>
                  <p className="mb-3 text-sm leading-relaxed" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                    We use the same LaTeX as{' '}
                    <code className="mono rounded bg-[var(--glass-nested)] px-1.5 py-0.5 text-xs">template.tex</code>
                    — Jake Gutierrez&apos;s template (MIT, from{' '}
                    <a
                      href="https://github.com/sb2nov/resume"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                      style={{ fontWeight: 800, color: '#0066FF' }}
                    >
                      sb2nov/resume
                    </a>
                    ): section underlines, subheadings, bullets, and Technical Skills block like the source file.
                  </p>
                  <p className="text-xs leading-relaxed" style={{ fontWeight: 200, color: 'var(--text-tertiary)' }}>
                    No other layout — exports are this single LaTeX style.
                  </p>
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between">
                  <span style={{ fontWeight: 200 }}>Auto-apply threshold</span>
                  <span className="mono text-lg" style={{ fontWeight: 400, color: '#0066FF' }}>
                    {fitThreshold[0]}
                  </span>
                </div>
                <Slider value={fitThreshold} onValueChange={setFitThreshold} max={100} step={1} />
              </div>
              <div>
                <label className="mb-2 block" style={{ fontWeight: 200 }}>
                  Daily application limit
                </label>
                <Input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="max-w-[120px] glass-nested rounded-[var(--radius-md)] border-0"
                  style={{ fontWeight: 200 }}
                />
              </div>
              <label
                className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed glass-nested"
                style={{ borderColor: 'rgba(255,255,255,0.5)' }}
              >
                <input type="file" accept=".csv,text/csv" className="hidden" />
                <span style={{ fontWeight: 800 }}>LinkedIn connections CSV</span>
                <span className="text-sm" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                  Optional
                </span>
              </label>
              <div className="flex flex-wrap items-center justify-between gap-4 glass-nested rounded-[var(--radius-xl)] p-4">
                <span style={{ fontWeight: 800 }}>Google Calendar</span>
                <button
                  type="button"
                  className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 glass-nested"
                  style={{ fontWeight: 800 }}
                >
                  Connect
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 glass-nested rounded-[var(--radius-xl)] p-4">
                <div>
                  <p style={{ fontWeight: 800 }}>Google Sheets sync</p>
                  <p className="text-sm" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
                    Push applications to a sheet
                  </p>
                </div>
                <Switch checked={sheetsEnabled} onCheckedChange={setSheetsEnabled} />
              </div>
              <button
                type="button"
                className="btn-micro rounded-[var(--radius-lg)] px-6 py-3 text-white"
                style={{ background: '#0066FF' }}
                onClick={() => setStep(5)}
              >
                Continue
              </button>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="s5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>Confirmation</h2>
              <div className="glass-nested space-y-2 rounded-[var(--radius-xl)] p-6" style={{ fontWeight: 200 }}>
                <p>
                  <span style={{ fontWeight: 800 }}>Template:</span> Jake&apos;s résumé (LaTeX,{' '}
                  <span className="mono text-sm" style={{ fontWeight: 400 }}>
                    template.tex
                  </span>
                  )
                </p>
                <p>
                  <span style={{ fontWeight: 800 }}>Threshold:</span>{' '}
                  <span className="mono" style={{ fontWeight: 400 }}>
                    {fitThreshold[0]}
                  </span>
                </p>
                <p>
                  <span style={{ fontWeight: 800 }}>Daily limit:</span>{' '}
                  <span className="mono" style={{ fontWeight: 400 }}>
                    {dailyLimit}
                  </span>
                </p>
                <p>
                  <span style={{ fontWeight: 800 }}>Sheets:</span> {sheetsEnabled ? 'On' : 'Off'}
                </p>
              </div>
              <button
                type="button"
                className="btn-micro w-full rounded-[var(--radius-lg)] py-4 text-white"
                style={{ background: '#0066FF', fontSize: '1.05rem' }}
                onClick={onComplete}
              >
                Start Applying
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
