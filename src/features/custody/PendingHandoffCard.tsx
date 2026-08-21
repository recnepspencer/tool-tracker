import { useState } from 'react';
import type { HandoffAction } from '../../domain/custody';
import type { PendingHandoffView } from '../../domain/read-models/custody';
import { CustodyEvidenceFields } from './CustodyEvidenceFields';
import { usePendingHandoffActionController } from './use-pending-handoff-action-controller';
import '../../styles/custody.css';

const actionLabel: Record<HandoffAction, string> = {
  accept: 'Accept — take custody',
  decline: 'Decline',
  cancel: 'Cancel transfer',
  withdraw: 'Withdraw request',
};

export function PendingHandoffCard({
  handoff,
  profileId,
  queryBlocked = false,
}: {
  handoff: PendingHandoffView;
  profileId: string;
  queryBlocked?: boolean;
}) {
  const [note, setNote] = useState('');
  const [mockPhoto, setMockPhoto] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const {
    act,
    busy,
    queryBlocked: handoffQueryBlocked,
    error,
  } = usePendingHandoffActionController({
    handoff,
    profileId,
    note,
    mockPhoto,
    queryBlocked,
  });
  const incoming = handoff.direction === 'incoming';
  return (
    <article
      className={`worker-pending-card worker-pending-card--${incoming ? 'incoming' : 'outgoing'}`}
      data-handoff-id={handoff.id}
      aria-label={`${handoff.toolName} pending handoff`}
    >
      <div className="worker-pending-topline">
        <span>{incoming ? 'Incoming transfer' : 'Awaiting acceptance'}</span>
        <time>{handoff.requestedAt}</time>
      </div>
      <strong className="worker-pending-title">
        {incoming ? `${handoff.from.name} sent you a tool` : `Transfer to ${handoff.to.name}`}
      </strong>
      <span className="worker-pending-tool-name">{handoff.toolName}</span>
      <span className="worker-pending-subtitle">
        {handoff.from.name} → {handoff.to.name}
      </span>
      {handoff.evidence?.note ? <small className="worker-pending-note">Note: {handoff.evidence.note}</small> : null}
      <button
        type="button"
        className="worker-pending-review"
        onClick={() => setReviewOpen((current) => !current)}
        aria-expanded={reviewOpen}
      >
        {reviewOpen ? 'Close review' : 'Review'}
      </button>
      {reviewOpen ? (
        <div className="worker-pending-review-panel">
          {handoff.allowedActions.length ? (
            <div className="pending-handoff-actions">
              {handoff.allowedActions.map((action) => (
                <button
                  type="button"
                  className={
                    action === 'accept'
                      ? 'worker-primary-button worker-primary-button--compact'
                      : 'worker-secondary-button'
                  }
                  key={action}
                  disabled={busy || handoffQueryBlocked}
                  onClick={() => void act(action)}
                >
                  {busy ? 'Saving…' : handoffQueryBlocked ? 'Unavailable' : actionLabel[action]}
                </button>
              ))}
              <button
                type="button"
                className="worker-evidence-toggle"
                onClick={() => setShowEvidence((value) => !value)}
                aria-expanded={showEvidence}
              >
                {showEvidence ? 'Hide note/photo' : 'Add note/photo'}
              </button>
            </div>
          ) : null}
          {showEvidence ? (
            <CustodyEvidenceFields
              className="pending-handoff-evidence"
              note={note}
              mockPhoto={mockPhoto}
              onNoteChange={setNote}
              onMockPhotoChange={setMockPhoto}
            />
          ) : null}
          {error ? (
            <small className="pending-handoff-error" role="alert">
              {error}
            </small>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
