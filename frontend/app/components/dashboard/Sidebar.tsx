import { motion } from 'motion/react';
import {
  Activity,
  LayoutGrid,
  Search,
  List,
  FileText,
  Settings,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { DashboardPage } from './MobileNav';

interface SidebarProps {
  currentPage: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
  onGoToLanding: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const navItems: { id: DashboardPage; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'home', label: 'Home', Icon: LayoutGrid },
  { id: 'feed', label: 'Activity', Icon: Activity },
  { id: 'jobs', label: 'Jobs Board', Icon: Search },
  { id: 'applications', label: 'Applications', Icon: List },
  { id: 'resumes', label: 'Resume Vault', Icon: FileText },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

const stats = [
  { label: 'Applied', value: '47', color: '#0066FF' },
  { label: 'Waiting', value: '12', color: '#F5A623' },
  { label: 'Interviews', value: '3', color: '#00B341' },
  { label: 'Offers', value: '2', color: '#00B341' },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  onGoToLanding,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const expanded = !collapsed;

  return (
    <motion.aside
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`glass-panel dashboard-sidebar-shell pointer-events-auto fixed top-0 left-0 z-40 hidden h-screen flex-col transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex ${
        collapsed ? 'w-[var(--dashboard-sidebar-collapsed)] p-4' : 'w-[var(--dashboard-sidebar-expanded)] p-6'
      }`}
      style={{ borderRadius: '0 var(--radius-2xl) var(--radius-2xl) 0' }}
    >
      <div
        className={`mb-6 flex shrink-0 items-center gap-2 ${expanded ? 'justify-between' : 'flex-col-reverse justify-center gap-3'}`}
      >
        {expanded ? (
          <div className="relative z-10 min-w-0 flex-1">
            <button
              type="button"
              onClick={onGoToLanding}
              className="block w-full cursor-pointer truncate rounded-md border-0 bg-transparent py-1 text-left text-base transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#0066FF]/40 focus-visible:outline-none"
              style={{ fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              aria-label="AutoApply — back to landing page"
            >
              AutoApply
            </button>
          </div>
        ) : (
          <div className="relative z-10 w-full">
            <button
              type="button"
              onClick={onGoToLanding}
              className="block w-full max-w-full cursor-pointer truncate rounded-md border-0 bg-transparent py-1 text-center text-[0.65rem] leading-tight transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#0066FF]/40 focus-visible:outline-none"
              style={{ fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              title="AutoApply — back to landing page"
              aria-label="AutoApply — back to landing page"
            >
              Auto
              <br />
              Apply
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className="btn-micro flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] text-[#6B6B6B] hover:text-[#1A1A1A]"
        >
          {expanded ? (
            <PanelLeftClose className="size-5" strokeWidth={1.5} />
          ) : (
            <PanelLeftOpen className="size-5" strokeWidth={1.5} />
          )}
        </button>
      </div>

      <nav
        className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto ${expanded ? 'items-stretch' : 'items-center'}`}
      >
        {navItems.map((item, i) => {
          const Icon = item.Icon;
          const active = currentPage === item.id;
          return (
            <motion.button
              key={item.id}
              type="button"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.05 }}
              onClick={() => onNavigate(item.id)}
              title={item.label}
              className={`btn-micro flex w-full items-center gap-3 rounded-[var(--radius-xl)] px-3 py-3 ${
                expanded ? 'justify-start' : 'justify-center'
              } ${active ? 'glass-nested' : ''}`}
              style={{
                fontWeight: active ? 800 : 200,
                color: active ? '#1A1A1A' : '#6B6B6B',
              }}
            >
              <Icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.5} />
              {expanded && <span className="truncate">{item.label}</span>}
            </motion.button>
          );
        })}
      </nav>

      <div className="mt-auto flex shrink-0 flex-col" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        {expanded ? (
          <div className="border-t pt-5" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
            <div className="space-y-2">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.4 + i * 0.05 }}
                  className="text-sm"
                  style={{ fontWeight: 200, color: '#6B6B6B' }}
                >
                  <span className="mono tabular-nums" style={{ color: stat.color, fontWeight: 400 }}>
                    {stat.value}
                  </span>{' '}
                  {stat.label}
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-2 border-t pt-4"
            style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="mono text-xs" style={{ color: stat.color, fontWeight: 400 }}>
                {stat.value}
              </div>
            ))}
          </div>
        )}

        <div
          className={`border-t pt-5 ${expanded ? '' : 'flex flex-col items-center pb-1'}`}
          style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}
        >
          <div className={`flex items-center gap-3 ${expanded ? '' : 'flex-col'}`}>
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full glass-nested">
              <User className="size-6 text-[var(--text-secondary)]" strokeWidth={1.5} />
            </div>
            {expanded && (
              <div className="min-w-0 flex-1">
                <div style={{ fontWeight: 800 }} className="truncate text-sm">
                  Alex Chen
                </div>
                <div style={{ fontWeight: 200 }} className="truncate text-xs text-[#6B6B6B]">
                  CS @ CMU
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
