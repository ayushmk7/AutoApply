import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

export default function ScreenBackButton({
  onClick,
  label = 'Back',
  ariaLabel,
}: {
  onClick: () => void;
  label?: string;
  /** Defaults to `${label}` for screen readers */
  ariaLabel?: string;
}) {
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.12 }}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className="btn-micro fixed left-4 top-4 z-[60] flex items-center gap-0.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs glass-panel md:left-6 md:top-6"
      style={{ fontWeight: 500 }}
    >
      <ChevronLeft className="size-4 shrink-0 -mr-0.5" strokeWidth={2} aria-hidden />
      {label}
    </motion.button>
  );
}
