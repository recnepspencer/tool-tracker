import { useState } from 'react';
import type { PendingHandoffView } from '../../domain/read-models/custody';
import type { ToolHolderView } from '../../domain/read-models/holder';
import type { HolderRef } from '../../domain/custody';
import type { TransferDestinationMode } from '../tool-detail/TransferDestinationPicker';
import { PendingHandoffReviewSheet } from './PendingHandoffReviewSheet';
import { usePendingHandoffActionController } from './use-pending-handoff-action-controller';
import { useTransferTargets } from './use-custody-queries';
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
  const incoming = handoff.direction === 'incoming';
  const editable = handoff.canEdit;
  const [note, setNote] = useState(handoff.evidence?.note ?? '');
  const [mockPhoto, setMockPhoto] = useState(handoff.evidence?.mockPhoto === true);
  const [target, setTarget] = useState(() => holderSelectionKey(handoff.to));
  const [transferMode, setTransferMode] = useState<TransferDestinationMode | null>(() =>
    handoff.to.type === 'worker' ? 'person' : 'warehouse',
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const transferTargets = useTransferTargets(
    profileId,
    editable ? handoff.toolUnitId : null,
    editable ? handoff.id : undefined,
  );
  const {
    act,
    saveEdit,
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
  const selectedTarget = transferTargets.data?.find((candidate) => holderSelectionKey(candidate) === target);
  const saveOutgoingEdit = () => {
    if (!selectedTarget) return Promise.resolve(false);
    return saveEdit(toHolderRef(selectedTarget));
  };
  return (
    <article
      className={`worker-pending-card worker-pending-card--${incoming ? 'incoming' : 'outgoing'}`}
      data-handoff-id={handoff.id}
      aria-label={`${handoff.toolName} pending handoff`}
    >
      <span className="worker-pending-direction">{incoming ? 'Incoming' : 'Outgoing'}</span>
      <strong className="worker-pending-title">{handoff.toolName}</strong>
      <span className="worker-pending-subtitle">
        {incoming
          ? `From ${handoff.from.name}`
          : handoff.kind === 'warehouse-request'
            ? `Requested from ${handoff.to.name}`
            : `To ${handoff.to.name}`}
      </span>
      <button
        type="button"
        className="worker-pending-review"
        onClick={() => setReviewOpen((current) => !current)}
        aria-expanded={reviewOpen}
      >
        {editable ? 'Edit transfer' : 'Review'}
      </button>
      {reviewOpen ? (
        <PendingHandoffReviewSheet
          handoff={handoff}
          note={note}
          mockPhoto={mockPhoto}
          busy={busy}
          queryBlocked={handoffQueryBlocked}
          error={error}
          editable={editable}
          transferTargets={transferTargets}
          target={target}
          transferMode={transferMode}
          onNoteChange={setNote}
          onMockPhotoChange={setMockPhoto}
          onTargetChange={setTarget}
          onTransferModeChange={(mode) => {
            setTransferMode(mode);
            setTarget('');
          }}
          onSaveEdit={saveOutgoingEdit}
          onAction={act}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </article>
  );
}

function holderSelectionKey(holder: ToolHolderView) {
  return holder.type === 'worker' ? `worker:${holder.userId}` : `warehouse:${holder.warehouseId}`;
}

function toHolderRef(holder: ToolHolderView): HolderRef {
  return holder.type === 'worker'
    ? { type: 'worker', userId: holder.userId }
    : { type: 'warehouse', warehouseId: holder.warehouseId };
}
