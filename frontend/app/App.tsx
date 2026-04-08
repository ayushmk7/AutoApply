import { useState } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import OnboardingFlow from './components/OnboardingFlow';
import { ModalProvider } from './context/ModalContext';
import { ModalHost } from './components/modals/ModalHost';
import { useApiSession } from './context/ApiSessionContext';

export type AppScreen = 'landing' | 'login' | 'onboarding' | 'dashboard';

export default function App() {
  const { signInDemo, signOutSession } = useApiSession();
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
              void (async () => {
                try {
                  await signInDemo();
                  setDemoMode(true);
                  setScreen('dashboard');
                } catch {
                  setDemoMode(true);
                  setScreen('dashboard');
                }
              })();
            }}
          />
        )}
        {screen === 'login' && (
          <LoginPage
            onBackToLanding={() => {
              setScreen('landing');
              window.scrollTo(0, 0);
            }}
            onAuthSuccess={() => {
              setDemoMode(false);
              setOnboardingInitialStep(1);
              setScreen('onboarding');
            }}
            onSkipToDemo={() => {
              void (async () => {
                try {
                  await signInDemo();
                  setDemoMode(true);
                  setScreen('dashboard');
                } catch {
                  setDemoMode(true);
                  setScreen('dashboard');
                }
              })();
            }}
          />
        )}
        {screen === 'onboarding' && (
          <OnboardingFlow
            key={onboardingInitialStep}
            initialStep={onboardingInitialStep}
            onExit={() => {
              setScreen(onboardingInitialStep >= 2 ? 'dashboard' : 'login');
              window.scrollTo(0, 0);
            }}
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
                void signOutSession();
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
