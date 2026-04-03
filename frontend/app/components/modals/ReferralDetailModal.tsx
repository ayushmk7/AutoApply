import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import type { ReferralModalPayload } from '../../context/ModalContext';

export function ReferralDetailModal({
  open,
  onOpenChange,
  payload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ReferralModalPayload;
}) {
  const company = payload.company ?? 'Company';
  const [message, setMessage] = useState(payload.draftMessage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-h-[90vh] max-w-lg overflow-y-auto border-0 sm:max-w-lg [&]:translate-x-[-50%] [&]:translate-y-[-50%] [&]:rounded-[var(--radius-2xl)] [&]:bg-[var(--glass-bg)] [&]:p-8 [&]:shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>
            Referral Path Found
          </DialogTitle>
        </DialogHeader>

        <div className="glass-nested mb-6 flex flex-wrap items-center gap-2 rounded-[var(--radius-xl)] p-4 text-sm">
          <span style={{ fontWeight: 200 }}>You</span>
          <span style={{ color: 'var(--text-tertiary)' }}>→</span>
          <span style={{ fontWeight: 200 }}>
            {payload.connectionName}, {payload.connectionRole}
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>→</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>{company}</span>
        </div>

        <div className="mb-4">
          <p style={{ fontWeight: 800, marginBottom: 8 }}>Connection details</p>
          <p style={{ fontWeight: 200, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {payload.howConnected}
          </p>
        </div>

        <label className="mb-2 block" style={{ fontWeight: 200 }}>
          Draft referral request
        </label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          className="glass-nested mb-6 rounded-[var(--radius-md)] border-0"
          style={{ fontWeight: 200 }}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="btn-micro flex-1 rounded-[var(--radius-lg)] py-3 text-white"
            style={{ background: '#0066FF' }}
          >
            Send Referral Request
          </button>
          <button
            type="button"
            className="btn-micro flex-1 rounded-[var(--radius-lg)] py-3 glass-nested"
            style={{ fontWeight: 800 }}
          >
            Apply Without Referral
          </button>
        </div>

        <p
          className="mt-6 text-center text-sm"
          style={{ fontWeight: 200, color: 'var(--text-secondary)' }}
        >
          Referral applications are 10x more likely to result in an interview
        </p>
      </DialogContent>
    </Dialog>
  );
}
