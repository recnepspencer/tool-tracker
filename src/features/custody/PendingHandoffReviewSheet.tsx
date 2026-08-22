import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import type { HandoffAction } from '../../domain/custody';
import type { ToolHolderView } from '../../domain/read-models/holder';
import type { PendingHandoffView } from '../../domain/read-models/custody';
import { CustodyEvidenceFields } from './CustodyEvidenceFields';
import { TransferDestinationPicker, type TransferDestinationMode } from '../tool-detail/TransferDestinationPicker';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { pendingHandoffDirectionLabel, pendingHandoffStatusLabel } from './pending-handoff-copy';
import { useState } from 'react';
import { responsiveToolImageSource } from '../../components/ui/responsive-image';
import type { CustodyPhotoEvidence } from '../../domain/evidence';

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
  photo,
  photoBusy,
  busy,
  queryBlocked,
  error,
  editable = false,
  transferTargets,
  target = '',
  transferMode = null,
  onNoteChange,
  onPhotoChange,
  onPhotoBusyChange,
  onTargetChange = () => undefined,
  onTransferModeChange = () => undefined,
  onSaveEdit = async () => false,
  onAction,
  onClose,
}: {
  handoff: PendingHandoffView;
  note: string;
  photo: CustodyPhotoEvidence | null;
  photoBusy: boolean;
  busy: boolean;
  queryBlocked: boolean;
  error: string | null;
  editable?: boolean;
  transferTargets?: TransferTargetsState;
  target?: string;
  transferMode?: TransferDestinationMode | null;
  onNoteChange(note: string): void;
  onPhotoChange(photo: CustodyPhotoEvidence | null): void;
  onPhotoBusyChange(busy: boolean): void;
  onTargetChange?(target: string): void;
  onTransferModeChange?(mode: TransferDestinationMode | null): void;
  onSaveEdit?(): Promise<boolean>;
  onAction(action: HandoffAction): Promise<boolean>;
  onClose(): void;
}) {
  const incoming = handoff.direction === 'incoming';
  const [toolVerified, setToolVerified] = useState(false);
  const DirectionIcon = incoming ? ArrowDownToLine : ArrowUpFromLine;
  const otherParty = incoming
    ? handoff.from.name
    : handoff.kind === 'warehouse-request'
      ? handoff.from.name
      : handoff.to.name;
  const directionLabel = pendingHandoffDirectionLabel(handoff.direction, handoff.kind, otherParty);
  const statusLabel = pendingHandoffStatusLabel(handoff.direction, handoff.kind, otherParty);
  const transferEditBlocked =
    editable &&
    (!transferTargets ||
      transferTargets.isPending ||
      transferTargets.isFetching ||
      transferTargets.isPaused ||
      transferTargets.isError ||
      !transferTargets.data?.some((candidate) => holderSelectionKey(candidate) === target));
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
      <div className="worker-pending-review-scroll" data-overlay-scroll>
        <div className="worker-pending-review-heading">
          <span
            className={
              incoming ? 'worker-pending-review-tag worker-pending-review-tag--incoming' : 'worker-pending-review-tag'
            }
          >
            <DirectionIcon aria-hidden="true" className="worker-pending-direction-icon" />
            {directionLabel}
          </span>
          <time dateTime={handoff.requestedAtInstant}>{handoff.requestedAt}</time>
        </div>
        <span className="worker-pending-review-status">{statusLabel}</span>
        <div className="worker-pending-review-hero">
          <div className="worker-pending-review-photo">
            <img
              src={handoff.imageSrc}
              srcSet={responsiveToolImageSource(handoff.imageSrc)}
              sizes="78px"
              alt={`${handoff.toolName} transfer photo`}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div>
            <h2>{handoff.toolName}</h2>
          </div>
        </div>
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
          photo={photo}
          onNoteChange={onNoteChange}
          onPhotoChange={onPhotoChange}
          onPhotoBusyChange={onPhotoBusyChange}
        />
        {incoming && handoff.allowedActions.includes('accept') ? (
          <button
            type="button"
            className={`worker-pending-verification${toolVerified ? ' worker-pending-verification--checked' : ''}`}
            role="checkbox"
            aria-checked={toolVerified}
            onClick={() => setToolVerified((current) => !current)}
          >
            <span aria-hidden="true">{toolVerified ? '✓' : ''}</span>
            <strong>I have inspected this tool</strong>
          </button>
        ) : null}
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
            disabled={busy || photoBusy || queryBlocked || transferEditBlocked}
            onClick={() => void onSaveEdit().then((saved) => saved && onClose())}
          >
            {photoBusy
              ? 'Processing photo…'
              : busy
                ? 'Saving…'
                : transferEditBlocked
                  ? 'Choose a destination'
                  : 'Save changes'}
          </button>
        ) : null}
        {handoff.allowedActions.map((action) => (
          <button
            type="button"
            key={action}
            className={
              action === 'accept' ? 'worker-primary-button worker-primary-button--compact' : 'worker-secondary-button'
            }
            disabled={busy || photoBusy || queryBlocked || (action === 'accept' && !toolVerified)}
            onClick={() => void runAction(action)}
          >
            {photoBusy ? 'Processing photo…' : busy ? 'Saving…' : queryBlocked ? 'Unavailable' : actionLabel[action]}
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
