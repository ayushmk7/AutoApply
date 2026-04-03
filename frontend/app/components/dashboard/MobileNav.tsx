import { motion } from 'motion/react';
import {
  Activity,
  LayoutGrid,
  Search,
  List,
  FileText,
  Settings,
} from 'lucide-react';

export type DashboardPage = 'home' | 'feed' | 'jobs' | 'applications' | 'resumes' | 'settings';

const items: { id: DashboardPage; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'home', label: 'Home', Icon: LayoutGrid },
  { id: 'feed', label: 'Activity', Icon: Activity },
  { id: 'jobs', label: 'Jobs', Icon: Search },
  { id: 'applications', label: 'Apps', Icon: List },
  { id: 'resumes', label: 'Vault', Icon: FileText },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export default function MobileNav({
  currentPage,
  onNavigate,
}: {
  currentPage: DashboardPage;
  onNavigate: (p: DashboardPage) => void;
}) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel fixed right-4 bottom-4 left-4 z-30 flex justify-around gap-1 rounded-[var(--radius-2xl)] px-2 py-3 lg:hidden"
      style={{ borderRadius: 'var(--radius-2xl)' }}
    >
      {items.map(({ id, label, Icon }) => {
        const active = currentPage === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className="btn-micro flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[var(--radius-lg)] px-2 py-1"
            style={{
              background: active ? 'var(--glass-nested)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            title={label}
          >
            <Icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.5} />
            <span className="truncate text-[0.65rem]" style={{ fontWeight: 800 }}>
              {label}
            </span>
          </button>
        );
      })}
    </motion.nav>
  );
}
