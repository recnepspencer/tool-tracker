import { useState } from 'react';
import { Button } from '../../components/ui/Button';
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
  return (
    <article
      className="pending-handoff"
      data-handoff-id={handoff.id}
      aria-label={`${handoff.toolName} pending handoff`}
    >
      <strong>{handoff.toolName}</strong>
      <span>
        {handoff.from.name} → {handoff.to.name}
      </span>
      <small>
        Requested by {handoff.requestedBy} · {handoff.requestedAt}
      </small>
      {handoff.evidence?.note ? <small>Note: {handoff.evidence.note}</small> : null}
      {handoff.allowedActions.length ? (
        <div className="pending-handoff-actions">
          {handoff.allowedActions.map((action) => (
            <Button
              key={action}
              variant={action === 'accept' ? 'primary' : 'secondary'}
              disabled={busy || handoffQueryBlocked}
              onClick={() => void act(action)}
            >
              {busy ? 'Saving…' : handoffQueryBlocked ? 'Unavailable' : actionLabel[action]}
            </Button>
          ))}
          <button
            type="button"
            className="text-button"
            onClick={() => setShowEvidence((value) => !value)}
            aria-expanded={showEvidence}
          >
            {showEvidence ? 'Hide evidence' : 'Add note/photo'}
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
    </article>
  );
}
