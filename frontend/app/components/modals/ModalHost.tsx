import { useModals } from '../../context/ModalContext';
import { AtsScoreModal } from './AtsScoreModal';
import { InterviewDetailModal } from './InterviewDetailModal';
import { ReferralDetailModal } from './ReferralDetailModal';

export function ModalHost() {
  const { modal, closeModal } = useModals();
  const open = modal.type !== 'closed';

  return (
    <>
      {modal.type === 'ats' && (
        <AtsScoreModal
          open={open}
          onOpenChange={(v) => !v && closeModal()}
          payload={modal.payload}
        />
      )}
      {modal.type === 'interview' && (
        <InterviewDetailModal
          open={open}
          onOpenChange={(v) => !v && closeModal()}
          payload={modal.payload}
        />
      )}
      {modal.type === 'referral' && (
        <ReferralDetailModal
          open={open}
          onOpenChange={(v) => !v && closeModal()}
          payload={modal.payload}
        />
      )}
    </>
  );
}
