import { createContext, useContext, useState } from 'react';
import { motion } from 'motion/react';
import Sidebar from './dashboard/Sidebar';
import MobileNav from './dashboard/MobileNav';
import type { DashboardPage } from './dashboard/MobileNav';
import HomeDashboard from './dashboard/HomeDashboard';
import LiveFeed from './dashboard/LiveFeed';
import JobsBoard from './dashboard/JobsBoard';
import ApplicationsTracker from './dashboard/ApplicationsTracker';
import ResumeVault from './dashboard/ResumeVault';
import Settings from './dashboard/Settings';

export type DashboardContextValue = {
  demoMode: boolean;
  onSignOut: () => void;
  onEditParsedCv: () => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboardContext must be used within Dashboard');
  return ctx;
}

export default function Dashboard({
  demoMode,
  onGoToLanding,
  onSignOut,
  onEditParsedCv,
}: {
  demoMode: boolean;
  onGoToLanding: () => void;
  onSignOut: () => void;
  onEditParsedCv: () => void;
}) {
  const [currentPage, setCurrentPage] = useState<DashboardPage>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const ctx: DashboardContextValue = { demoMode, onSignOut, onEditParsedCv };

  return (
    <DashboardContext.Provider value={ctx}>
      <div className="relative z-10 flex min-h-screen w-full">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onGoToLanding={onGoToLanding}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        />
        <MobileNav currentPage={currentPage} onNavigate={setCurrentPage} />

        <div
          className="dashboard-main pointer-events-none relative z-0 flex-1 pb-24 pt-6 lg:pb-6"
          data-sidebar-collapsed={sidebarCollapsed ? 'true' : undefined}
        >
          <motion.div
            key={currentPage}
            className="pointer-events-auto min-h-[calc(100vh-1.5rem)] w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {currentPage === 'home' && <HomeDashboard onNavigate={setCurrentPage} />}
            {currentPage === 'feed' && <LiveFeed />}
            {currentPage === 'jobs' && <JobsBoard />}
            {currentPage === 'applications' && <ApplicationsTracker />}
            {currentPage === 'resumes' && <ResumeVault />}
            {currentPage === 'settings' && <Settings />}
          </motion.div>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
