import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import type { InterviewModalPayload } from '../../context/ModalContext';

function TimelineNode({
  label,
  date,
  filled,
}: {
  label: string;
  date?: string;
  filled: boolean;
}) {
  return (
    <div className="flex min-w-[100px] flex-col items-center gap-2 text-center">
      <div
        className="flex size-10 items-center justify-center rounded-full border-2"
        style={{
          borderColor: filled ? '#0066FF' : 'rgba(255,255,255,0.6)',
          background: filled ? 'rgba(0,102,255,0.12)' : 'transparent',
        }}
      >
        {filled ? <Check className="size-4 text-[#0066FF]" strokeWidth={2.5} /> : null}
      </div>
      <div style={{ fontWeight: 800, fontSize: '0.75rem' }}>{label}</div>
      {date && (
        <div className="mono text-[0.65rem]" style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
          {date}
        </div>
      )}
    </div>
  );
}

export function InterviewDetailModal({
  open,
  onOpenChange,
  payload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: InterviewModalPayload;
}) {
  const [notes, setNotes] = useState('');
  const [thankYou, setThankYou] = useState(
    `Hi team,\n\nThank you for the conversation about ${payload.role}. I enjoyed discussing…\n\nBest,\nAlex`,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-h-[92vh] max-w-3xl overflow-y-auto border-0 sm:max-w-3xl [&]:translate-x-[-50%] [&]:translate-y-[-50%] [&]:rounded-[var(--radius-2xl)] [&]:bg-[var(--glass-bg)] [&]:p-8 [&]:shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.75rem' }}>
            {payload.company} — {payload.role}
          </DialogTitle>
        </DialogHeader>

        <div className="glass-nested mb-6 rounded-[var(--radius-xl)] p-6">
          <h4 className="mb-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Interview timeline
          </h4>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <TimelineNode label="Applied" date={payload.appliedDate} filled />
            <div className="hidden h-px flex-1 self-center bg-[rgba(255,255,255,0.5)] sm:block" />
            <TimelineNode label="Response" date={payload.responseDate} filled />
            <div className="hidden h-px flex-1 self-center bg-[rgba(255,255,255,0.5)] sm:block" />
            <TimelineNode label="Interview" date={payload.interviewDate} filled />
            <div className="hidden h-px flex-1 self-center bg-[rgba(255,255,255,0.5)] sm:block" />
            <TimelineNode label="Thank You" filled={false} />
            <div className="hidden h-px flex-1 self-center bg-[rgba(255,255,255,0.5)] sm:block" />
            <TimelineNode label="Follow-up" filled={false} />
          </div>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <div className="glass-nested rounded-[var(--radius-xl)] p-5">
            <h4 className="mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              Interview details
            </h4>
            <p style={{ fontWeight: 200 }} className="mb-1">
              <span style={{ fontWeight: 800 }}>When:</span> {payload.interviewDate}
            </p>
            <p style={{ fontWeight: 200 }} className="mb-1">
              <span style={{ fontWeight: 800 }}>Format:</span> {payload.format}
            </p>
            <p style={{ fontWeight: 200 }} className="mb-1">
              <span style={{ fontWeight: 800 }}>Interviewers:</span>{' '}
              {payload.interviewers.join(', ')}
            </p>
            <a
              href={payload.calendarLink}
              className="text-sm underline"
              style={{ color: '#0066FF', fontWeight: 200 }}
            >
              Calendar event
            </a>
          </div>
          <div className="glass-nested rounded-[var(--radius-xl)] p-5">
            <h4 className="mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              Prep materials
            </h4>
            <p style={{ fontWeight: 200, fontSize: '0.875rem', marginBottom: 12 }}>{payload.prepOverview}</p>
            <p style={{ fontWeight: 800, fontSize: '0.75rem', marginBottom: 4 }}>Talking points</p>
            <ul className="mb-3 list-disc pl-5" style={{ fontWeight: 200, fontSize: '0.875rem' }}>
              {payload.talkingPoints.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p style={{ fontWeight: 800, fontSize: '0.75rem', marginBottom: 4 }}>Likely questions</p>
            <ul className="mb-3 list-disc pl-5" style={{ fontWeight: 200, fontSize: '0.875rem' }}>
              {payload.likelyQuestions.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p style={{ fontWeight: 800, fontSize: '0.75rem', marginBottom: 4 }}>Resume highlights</p>
            <ul className="list-disc pl-5" style={{ fontWeight: 200, fontSize: '0.875rem' }}>
              {payload.resumeHighlights.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="glass-nested mb-6 rounded-[var(--radius-xl)] p-5">
          <h4 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Post-interview
          </h4>
          <label className="mb-2 block" style={{ fontWeight: 200 }}>
            How did it go?
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="glass-nested mb-4 rounded-[var(--radius-md)] border-0"
            style={{ fontWeight: 200 }}
          />
          <button
            type="button"
            className="btn-micro mb-3 rounded-[var(--radius-lg)] px-4 py-2 text-white"
            style={{ background: '#0066FF' }}
          >
            Generate Thank-You Email
          </button>
          <Textarea
            value={thankYou}
            onChange={(e) => setThankYou(e.target.value)}
            rows={5}
            className="glass-nested mb-3 rounded-[var(--radius-md)] border-0"
            style={{ fontWeight: 200 }}
          />
          <button
            type="button"
            className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 text-white"
            style={{ background: '#00B341' }}
          >
            Send
          </button>
        </div>

        <div className="glass-nested rounded-[var(--radius-xl)] p-5">
          <h4 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Follow-up
          </h4>
          <p className="mono mb-3 text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
            3 of 5 business days elapsed
          </p>
          <button
            type="button"
            className="btn-micro rounded-[var(--radius-lg)] px-4 py-2 text-white"
            style={{ background: '#0066FF', opacity: 0.5 }}
            disabled
          >
            Generate Follow-Up
          </button>
          <p style={{ fontWeight: 200, fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
            Available after timer completes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
