import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { AtsModalPayload } from '../../context/ModalContext';

function scoreColor(score: number) {
  if (score >= 80) return '#00B341';
  if (score >= 60) return '#F5A623';
  return '#FF3B30';
}

export function AtsScoreModal({
  open,
  onOpenChange,
  payload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: AtsModalPayload;
}) {
  const color = scoreColor(payload.score);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-h-[90vh] max-w-lg overflow-y-auto border-0 sm:max-w-lg [&]:translate-x-[-50%] [&]:translate-y-[-50%] [&]:rounded-[var(--radius-2xl)] [&]:bg-[var(--glass-bg)] [&]:p-8 [&]:shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>
            ATS score
          </DialogTitle>
        </DialogHeader>
        <div
          className="mono text-center text-6xl tabular-nums"
          style={{ color, fontWeight: 900 }}
        >
          {payload.score}%
        </div>
        <div className="glass-nested h-2 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, payload.score)}%`, background: color }}
          />
        </div>
        <div>
          <h4 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Matched Keywords
          </h4>
          <div className="flex flex-wrap gap-2">
            {payload.matched.map((k) => (
              <span
                key={k}
                className="rounded-[var(--radius-sm)] px-2 py-1 text-xs"
                style={{
                  background: 'rgba(0, 179, 65, 0.12)',
                  color: '#00B341',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 400,
                }}
              >
                {k}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Missing Keywords
          </h4>
          <div className="flex flex-wrap gap-2">
            {payload.missing.length === 0 ? (
              <span style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>None flagged</span>
            ) : (
              payload.missing.map((k) => (
                <span
                  key={k}
                  className="rounded-[var(--radius-sm)] px-2 py-1 text-xs"
                  style={{
                    background: 'rgba(255, 59, 48, 0.1)',
                    color: '#FF3B30',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 400,
                  }}
                >
                  {k}
                </span>
              ))
            )}
          </div>
        </div>
        <div>
          <h4 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Suggestions
          </h4>
          <p style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>{payload.suggestions}</p>
        </div>
        {payload.autoRevised && (
          <div className="glass-nested rounded-[var(--radius-xl)] p-4">
            <p style={{ fontWeight: 800, marginBottom: 8 }}>Resume was auto-revised</p>
            <p style={{ fontWeight: 200, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {payload.diffSummary}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
