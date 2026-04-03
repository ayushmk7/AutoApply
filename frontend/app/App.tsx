import { useState } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import OnboardingFlow from './components/OnboardingFlow';
import { ModalProvider } from './context/ModalContext';
import { ModalHost } from './components/modals/ModalHost';

export type AppScreen = 'landing' | 'login' | 'onboarding' | 'dashboard';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [demoMode, setDemoMode] = useState(false);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState(1);

  return (
    <ModalProvider>
      <div className="relative size-full min-h-screen overflow-x-hidden">
        {screen === 'landing' && (
          <LandingPage
            onGetStarted={() => setScreen('login')}
            onSkipToDemo={() => {
              setDemoMode(true);
              setScreen('dashboard');
            }}
          />
        )}
        {screen === 'login' && (
          <LoginPage
            onAuthSuccess={() => {
              setDemoMode(false);
              setOnboardingInitialStep(1);
              setScreen('onboarding');
            }}
            onSkipToDemo={() => {
              setDemoMode(true);
              setScreen('dashboard');
            }}
          />
        )}
        {screen === 'onboarding' && (
          <OnboardingFlow
            key={onboardingInitialStep}
            initialStep={onboardingInitialStep}
            onComplete={() => setScreen('dashboard')}
          />
        )}
        {screen === 'dashboard' && (
          <>
            <Dashboard
              demoMode={demoMode}
              onGoToLanding={() => {
                setScreen('landing');
                window.scrollTo(0, 0);
              }}
              onSignOut={() => {
                setScreen('landing');
                setDemoMode(false);
              }}
              onEditParsedCv={() => {
                setOnboardingInitialStep(2);
                setScreen('onboarding');
              }}
            />
            <ModalHost />
          </>
        )}
      </div>
    </ModalProvider>
  );
}
