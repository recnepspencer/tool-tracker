import { useState } from 'react';
import type { PendingHandoffView } from '../../domain/read-models/custody';
import { PendingHandoffReviewSheet } from './PendingHandoffReviewSheet';
import { usePendingHandoffActionController } from './use-pending-handoff-action-controller';
import '../../styles/custody.css';

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
        <span>
          {incoming
            ? 'Incoming transfer'
            : handoff.kind === 'warehouse-request'
              ? 'Awaiting warehouse approval'
              : 'Awaiting acceptance'}
        </span>
        <time>{handoff.requestedAt}</time>
      </div>
      <strong className="worker-pending-title">{handoff.toolName}</strong>
      <span className="worker-pending-subtitle">
        {incoming
          ? `From ${handoff.from.name} · check it matches the photo`
          : handoff.kind === 'warehouse-request'
            ? `Requested from ${handoff.to.name}`
            : `To ${handoff.to.name}`}
      </span>
      {handoff.evidence?.note ? <small className="worker-pending-note">Note: {handoff.evidence.note}</small> : null}
      <button
        type="button"
        className="worker-pending-review"
        onClick={() => setReviewOpen((current) => !current)}
        aria-expanded={reviewOpen}
      >
        Review
      </button>
      {reviewOpen ? (
        <PendingHandoffReviewSheet
          handoff={handoff}
          note={note}
          mockPhoto={mockPhoto}
          busy={busy}
          queryBlocked={handoffQueryBlocked}
          error={error}
          onNoteChange={setNote}
          onMockPhotoChange={setMockPhoto}
          onAction={act}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </article>
  );
}
