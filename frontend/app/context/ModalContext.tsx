import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DemoApplication } from '../data/demoData';
import {
  demoAtsDetail,
  demoInterviewDetail,
  demoReferralDetail,
} from '../data/demoData';

export type AtsModalPayload = {
  score: number;
  matched: string[];
  missing: string[];
  suggestions: string;
  autoRevised?: boolean;
  diffSummary?: string;
};

export type InterviewModalPayload = typeof demoInterviewDetail;

export type ReferralModalPayload = typeof demoReferralDetail & {
  company?: string;
};

type ModalState =
  | { type: 'closed' }
  | { type: 'ats'; payload: AtsModalPayload }
  | { type: 'interview'; payload: InterviewModalPayload }
  | { type: 'referral'; payload: ReferralModalPayload };

type ModalContextValue = {
  modal: ModalState;
  openAts: (payload?: Partial<AtsModalPayload> & { score: number }) => void;
  openAtsFromApplication: (app: DemoApplication) => void;
  openInterview: (payload?: Partial<InterviewModalPayload>) => void;
  openReferral: (payload?: Partial<ReferralModalPayload>) => void;
  closeModal: () => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ type: 'closed' });

  const closeModal = useCallback(() => setModal({ type: 'closed' }), []);

  const openAts = useCallback(
    (partial?: Partial<AtsModalPayload> & { score: number }) => {
      const score = partial?.score ?? demoAtsDetail.score;
      setModal({
        type: 'ats',
        payload: {
          score,
          matched: partial?.matched ?? demoAtsDetail.matched,
          missing: partial?.missing ?? demoAtsDetail.missing,
          suggestions: partial?.suggestions ?? demoAtsDetail.suggestions,
          autoRevised: partial?.autoRevised ?? demoAtsDetail.autoRevised,
          diffSummary: partial?.diffSummary ?? demoAtsDetail.diffSummary,
        },
      });
    },
    [],
  );

  const openAtsFromApplication = useCallback((app: DemoApplication) => {
    if (app.atsScore <= 0) return;
    setModal({
      type: 'ats',
      payload: {
        score: app.atsScore,
        matched: app.matchedKeywords?.length ? app.matchedKeywords : demoAtsDetail.matched,
        missing: app.missingKeywords?.length ? app.missingKeywords : demoAtsDetail.missing,
        suggestions: demoAtsDetail.suggestions,
        autoRevised: app.autoRevised ?? demoAtsDetail.autoRevised,
        diffSummary: demoAtsDetail.diffSummary,
      },
    });
  }, []);

  const openInterview = useCallback((partial?: Partial<InterviewModalPayload>) => {
    setModal({
      type: 'interview',
      payload: { ...demoInterviewDetail, ...partial },
    });
  }, []);

  const openReferral = useCallback((partial?: Partial<ReferralModalPayload>) => {
    setModal({
      type: 'referral',
      payload: { ...demoReferralDetail, ...partial },
    });
  }, []);

  const value = useMemo(
    () => ({
      modal,
      openAts,
      openAtsFromApplication,
      openInterview,
      openReferral,
      closeModal,
    }),
    [modal, openAts, openAtsFromApplication, openInterview, openReferral, closeModal],
  );

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModals() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModals must be used within ModalProvider');
  return ctx;
}
