import { OverlayDialog } from '../../components/ui/OverlayDialog';
import type { HandoffAction } from '../../domain/custody';
import type { ToolHolderView } from '../../domain/read-models/holder';
import type { PendingHandoffView } from '../../domain/read-models/custody';
import { CustodyEvidenceFields } from './CustodyEvidenceFields';
import { TransferDestinationPicker, type TransferDestinationMode } from '../tool-detail/TransferDestinationPicker';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';

const actionLabel: Record<HandoffAction, string> = {
  accept: 'Accept — take custody',
  decline: 'Decline',
  cancel: 'Cancel transfer',
  withdraw: 'Withdraw request',
};

interface TransferTargetsState {
  isPending: boolean;
  isFetching: boolean;
  isPaused: boolean;
  isError: boolean;
  data?: ToolHolderView[];
}

export function PendingHandoffReviewSheet({
  handoff,
  note,
  mockPhoto,
  busy,
  queryBlocked,
  error,
  editable = false,
  transferTargets,
  target = '',
  transferMode = null,
  onNoteChange,
  onMockPhotoChange,
  onTargetChange = () => undefined,
  onTransferModeChange = () => undefined,
  onSaveEdit = async () => false,
  onAction,
  onClose,
}: {
  handoff: PendingHandoffView;
  note: string;
  mockPhoto: boolean;
  busy: boolean;
  queryBlocked: boolean;
  error: string | null;
  editable?: boolean;
  transferTargets?: TransferTargetsState;
  target?: string;
  transferMode?: TransferDestinationMode | null;
  onNoteChange(note: string): void;
  onMockPhotoChange(mockPhoto: boolean): void;
  onTargetChange?(target: string): void;
  onTransferModeChange?(mode: TransferDestinationMode | null): void;
  onSaveEdit?(): Promise<boolean>;
  onAction(action: HandoffAction): Promise<boolean>;
  onClose(): void;
}) {
  const incoming = handoff.direction === 'incoming';
  const transferEditBlocked =
    editable &&
    (!transferTargets ||
      transferTargets.isPending ||
      transferTargets.isFetching ||
      transferTargets.isPaused ||
      transferTargets.isError ||
      !transferTargets.data?.some((candidate) => holderSelectionKey(candidate) === target));
  const subtitle = incoming
    ? `From ${handoff.from.name} · check it matches the photo`
    : handoff.kind === 'warehouse-request'
      ? `Requested from ${handoff.to.name}`
      : `Sent to ${handoff.to.name}`;
  const runAction = async (action: HandoffAction) => {
    if (await onAction(action)) onClose();
  };

  return (
    <OverlayDialog
      label={`${handoff.toolName} transfer review`}
      onClose={onClose}
      backdropClassName="worker-pending-review-backdrop"
      panelClassName={`worker-pending-review-sheet worker-pending-review-sheet--${incoming ? 'incoming' : 'outgoing'}`}
    >
      <div className="worker-pending-review-handle-wrap">
        <span className="worker-sheet-handle" />
      </div>
      <div className="worker-pending-review-scroll">
        <div className="worker-pending-review-heading">
          <span
            className={
              incoming ? 'worker-pending-review-tag worker-pending-review-tag--incoming' : 'worker-pending-review-tag'
            }
          >
            {incoming
              ? 'Incoming transfer'
              : handoff.kind === 'warehouse-request'
                ? 'Awaiting warehouse approval'
                : 'Awaiting acceptance'}
          </span>
          <time>{handoff.requestedAt}</time>
        </div>
        <div className="worker-pending-review-hero">
          <div className="worker-pending-review-photo">
            <img src={handoff.imageSrc} alt={`${handoff.toolName} transfer photo`} />
          </div>
          <div>
            <h2>{handoff.toolName}</h2>
            <p>{subtitle}</p>
          </div>
        </div>
        {incoming ? (
          <p className="worker-pending-review-callout">
            Check the tool in front of you against the photo before accepting. Accepting is the proof of handoff.
          </p>
        ) : null}
        {editable ? (
          <p className="worker-pending-review-callout worker-pending-review-callout--edit">
            Update the destination or evidence before the recipient accepts. Photos are optional.
          </p>
        ) : null}
        {editable && transferTargets ? (
          transferTargets.isPending || transferTargets.isFetching || transferTargets.isPaused ? (
            <LoadingState label="Loading transfer destinations…" />
          ) : transferTargets.isError ? (
            <ErrorState message="Transfer destinations could not be loaded." />
          ) : (
            <TransferDestinationPicker
              candidates={transferTargets.data ?? []}
              mode={transferMode}
              target={target}
              onModeChange={onTransferModeChange}
              onTargetChange={onTargetChange}
            />
          )
        ) : null}
        <CustodyEvidenceFields
          className="worker-pending-review-evidence"
          context={incoming ? 'review' : handoff.kind === 'transfer' ? 'transfer' : 'request'}
          notePlaceholder={
            incoming ? 'e.g. chuck is loose' : handoff.kind === 'transfer' ? 'e.g. reason for the transfer' : undefined
          }
          note={note}
          mockPhoto={mockPhoto}
          onNoteChange={onNoteChange}
          onMockPhotoChange={onMockPhotoChange}
        />
        {error ? (
          <small className="pending-handoff-error" role="alert">
            {error}
          </small>
        ) : null}
      </div>
      <div className="worker-pending-review-footer">
        {editable ? (
          <button
            type="button"
            className="worker-primary-button worker-primary-button--compact"
            disabled={busy || queryBlocked || transferEditBlocked}
            onClick={() => void onSaveEdit().then((saved) => saved && onClose())}
          >
            {busy ? 'Saving…' : transferEditBlocked ? 'Choose a destination' : 'Save changes'}
          </button>
        ) : null}
        {handoff.allowedActions.map((action) => (
          <button
            type="button"
            key={action}
            className={
              action === 'accept' ? 'worker-primary-button worker-primary-button--compact' : 'worker-secondary-button'
            }
            disabled={busy || queryBlocked}
            onClick={() => void runAction(action)}
          >
            {busy ? 'Saving…' : queryBlocked ? 'Unavailable' : actionLabel[action]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="worker-pending-review-close icon-button"
        aria-label="Close transfer review"
        onClick={onClose}
      >
        ×
      </button>
    </OverlayDialog>
  );
}

function holderSelectionKey(holder: ToolHolderView) {
  return holder.type === 'worker' ? `worker:${holder.userId}` : `warehouse:${holder.warehouseId}`;
}
