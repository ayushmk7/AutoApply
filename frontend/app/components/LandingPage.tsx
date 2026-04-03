import { motion } from 'motion/react';
import { Check } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onSkipToDemo: () => void;
}

const feedPreviewItems = [
  { company: 'Google', role: 'Software Engineer Intern', status: 'ATS Score: 94%', color: '#00B341' },
  { company: 'Meta', role: 'Frontend Developer', status: 'Submitted successfully', color: '#0066FF' },
  { company: 'Microsoft', role: 'Product Manager Intern', status: 'Generating resume...', color: '#F5A623' },
  { company: 'Stripe', role: 'Software Engineer', status: 'Referral path found', color: '#5AC8FA' },
  { company: 'Notion', role: 'Frontend Engineer', status: 'ATS Score: 88%', color: '#00B341' },
];

export default function LandingPage({ onGetStarted, onSkipToDemo }: LandingPageProps) {
  const doubledFeed = [...feedPreviewItems, ...feedPreviewItems];

  return (
    <div className="relative z-10 w-full min-h-screen">
      <section className="flex min-h-screen items-center justify-center px-6">
        <div className="mx-auto max-w-5xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            style={{ fontWeight: 900, letterSpacing: '-0.03em', fontFamily: 'var(--font-display)' }}
            className="mb-6 text-6xl md:text-7xl lg:text-8xl"
          >
            Upload Your CV.
            <br />
            Get Interviews.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            style={{ fontWeight: 200, letterSpacing: '0.01em' }}
            className="mb-12 text-2xl md:text-3xl text-[#6B6B6B]"
          >
            Everything in between is automated.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <button
              type="button"
              onClick={onGetStarted}
              className="btn-micro rounded-[var(--radius-lg)] px-8 py-4 text-white"
              style={{
                background: '#0066FF',
                boxShadow: '0 8px 32px rgba(0, 102, 255, 0.3)',
              }}
            >
              Get Started
            </button>

            <button
              type="button"
              onClick={onSkipToDemo}
              className="btn-micro rounded-[var(--radius-lg)] px-8 py-4 glass-panel"
            >
              Skip to Demo
            </button>
          </motion.div>
        </div>
      </section>

      <section className="px-6 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
          className="mx-auto max-w-6xl overflow-hidden glass-panel p-8"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="size-2.5 animate-pulse rounded-full bg-[#00B341]" />
            <h3 style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>Live Application Feed</h3>
          </div>

          <div className="relative h-[280px] overflow-hidden">
            <div
              className="space-y-3"
              style={{
                animation: 'landingFeedScroll 28s linear infinite',
              }}
            >
              {doubledFeed.map((item, i) => (
                <div key={`${item.company}-${i}`} className="glass-nested flex items-center justify-between p-4">
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.company}</div>
                    <div style={{ fontWeight: 200 }} className="text-sm text-[#6B6B6B]">
                      {item.role}
                    </div>
                  </div>
                  <div
                    className="mono rounded-full px-3 py-1 text-sm"
                    style={{ background: `${item.color}15`, color: item.color, fontWeight: 400 }}
                  >
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
        <style>{`
          @keyframes landingFeedScroll {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
        `}</style>
      </section>

      <section className="px-6 pb-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-6 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel p-8 md:col-span-4 lg:col-span-7 lg:row-span-1"
          >
            <h3 className="mb-3" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
              Custom Resume Per Application
            </h3>
            <p style={{ fontWeight: 200 }} className="mb-4 text-[#6B6B6B]">
              AI tailors your resume for each role, emphasizing relevant experience and keywords for maximum ATS
              scores.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-nested p-3 text-xs">
                <div className="mono mb-1 text-[#0066FF]" style={{ fontWeight: 400 }}>
                  Resume A
                </div>
                <div style={{ fontWeight: 200 }}>ML • Python • Research</div>
              </div>
              <div className="glass-nested p-3 text-xs">
                <div className="mono mb-1 text-[#00B341]" style={{ fontWeight: 400 }}>
                  Resume B
                </div>
                <div style={{ fontWeight: 200 }}>React • TS • Frontend</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
            className="glass-panel p-8 md:col-span-2 lg:col-span-5"
          >
            <h3 className="mb-3" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
              Ghost Job Detection
            </h3>
            <p style={{ fontWeight: 200 }} className="mb-4 text-[#6B6B6B]">
              Automatically flags and skips suspicious listings that are likely ghost jobs, saving you time and effort.
            </p>
            <div
              className="glass-nested border border-[#FF3B30]/30 p-3"
              style={{ background: 'rgba(255, 59, 48, 0.04)' }}
            >
              <div className="flex items-center justify-between">
                <div style={{ fontWeight: 200 }} className="line-through opacity-60">
                  TechCorp Inc.
                </div>
                <div className="rounded-full px-2 py-1 text-xs" style={{ background: '#FF3B3020', color: '#FF3B30', fontWeight: 800 }}>
                  Likely Ghost
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
            className="glass-panel p-8 md:col-span-3 lg:col-span-5"
          >
            <h3 className="mb-3" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
              Referral Mining
            </h3>
            <p style={{ fontWeight: 200 }} className="mb-4 text-[#6B6B6B]">
              Finds connection paths through your LinkedIn network, making referral requests 10x more effective.
            </p>
            <div className="glass-nested flex items-center gap-2 p-3 text-sm">
              <span style={{ fontWeight: 200 }}>You</span>
              <span className="text-[#6B6B6B]">→</span>
              <span style={{ fontWeight: 200 }}>Sarah Chen</span>
              <span className="text-[#6B6B6B]">→</span>
              <span style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>Apple</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
            className="glass-panel p-8 md:col-span-3 lg:col-span-7 lg:min-h-[220px]"
          >
            <h3 className="mb-3" style={{ fontWeight: 900, fontFamily: 'var(--font-display)' }}>
              Interview Autopilot
            </h3>
            <p style={{ fontWeight: 200 }} className="mb-4 text-[#6B6B6B]">
              Generates prep materials, sends thank-you emails, and manages follow-ups automatically.
            </p>
            <div className="flex items-center justify-between glass-nested p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-[#0066FF] text-white">
                  <Check className="size-4" strokeWidth={3} />
                </div>
                <div className="h-px w-8 bg-[rgba(0,0,0,0.08)]" />
                <div className="flex size-9 items-center justify-center rounded-full bg-[#00B341] text-white">
                  <Check className="size-4" strokeWidth={3} />
                </div>
                <div className="h-px w-8 bg-[rgba(0,0,0,0.08)]" />
                <div
                  className="flex size-9 items-center justify-center rounded-full border-2 border-[#F5A623] text-xs"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 400 }}
                >
                  3
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer
        className="px-6 py-12 text-center text-sm"
        style={{ fontWeight: 200, color: '#6B6B6B' }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-center gap-6">
          <a href="#privacy" className="underline-offset-4 hover:underline">
            Privacy
          </a>
          <a href="#terms" className="underline-offset-4 hover:underline">
            Terms
          </a>
          <a href="#contact" className="underline-offset-4 hover:underline">
            Contact
          </a>
        </div>
        <p>© 2026 AutoApply. Built for students, by students.</p>
      </footer>
    </div>
  );
}
