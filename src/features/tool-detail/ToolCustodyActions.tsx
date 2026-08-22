import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { SelectField } from '../../components/ui/SelectField';
import type { AuthSession } from '../../domain/auth';
import { workerCustodyActionPolicy } from '../../domain/custody-policy';
import type { ToolDetailView } from '../../domain/read-models/tools';
import type { ToolHolderView } from '../../domain/read-models/holder';
import type { CustodyPhotoEvidence } from '../../domain/evidence';
import { CustodyEvidenceFields } from '../custody/CustodyEvidenceFields';
import type { CheckoutUnitOption } from './checkout-unit-option';
import { holderSelectionKey } from './holder-selection-key';
import { toToolHolderRef } from './holder-ref';
import type { DetailAction } from './detail-action-types';
import { TransferDestinationPicker, type TransferDestinationMode } from './TransferDestinationPicker';

interface ToolCustodyActionsProps {
  detail: ToolDetailView;
  session: AuthSession | null;
  action: DetailAction | null;
  target: string;
  note: string;
  photo: CustodyPhotoEvidence | null;
  photoBusy?: boolean;
  transferMode?: TransferDestinationMode | null;
  canStartHandoff: boolean;
  detailRefreshing: boolean;
  busy: boolean;
  targets: { isPending: boolean; isFetching: boolean; isPaused: boolean; isError: boolean; data?: ToolHolderView[] };
  requestUnits?: CheckoutUnitOption[];
  onAction(action: DetailAction): void;
  onTargetChange(target: string): void;
  onRequestUnitChange?(unitId: string): void;
  onTransferModeChange?(mode: TransferDestinationMode | null): void;
  onNoteChange(note: string): void;
  onPhotoChange(photo: CustodyPhotoEvidence | null): void;
  onPhotoBusyChange?(busy: boolean): void;
  onCloseAction(): void;
  onSubmit(): void;
}

export function ToolCustodyActions({
  detail,
  session,
  action,
  target,
  note,
  photo,
  photoBusy = false,
  transferMode = null,
  canStartHandoff,
  detailRefreshing,
  busy,
  targets,
  requestUnits,
  onAction,
  onTargetChange,
  onRequestUnitChange,
  onTransferModeChange = () => undefined,
  onNoteChange,
  onPhotoChange,
  onPhotoBusyChange = () => undefined,
  onCloseAction,
  onSubmit,
}: ToolCustodyActionsProps) {
  const selectedTarget = targets.data?.find((candidate) => holderSelectionKey(candidate) === target);
  const activeTransferMode =
    transferMode ?? (selectedTarget ? (selectedTarget.type === 'warehouse' ? 'warehouse' : 'person') : null);
  const isCheckoutRequest = action === 'request' && requestUnits !== undefined;
  const actionPolicy = workerCustodyActionPolicy({
    actorRole: session?.role ?? null,
    actorId: session?.profileId ?? null,
    lifecycle: detail.lifecycle,
    condition: detail.condition,
    status: detail.tool.status,
    holder: toToolHolderRef(detail.tool.holder),
  });
  const canSubmit =
    canStartHandoff &&
    !detailRefreshing &&
    detail.lifecycle === 'active' &&
    !busy &&
    !photoBusy &&
    !(
      action === 'transfer' &&
      (targets.isPending || targets.isFetching || targets.isPaused || targets.isError || !selectedTarget)
    );
  return (
    <>
      {!action ? (
        <section className="detail-actions" aria-label="Custody actions">
          {canStartHandoff && actionPolicy.canRequest ? (
            <Button variant="primary" onClick={() => onAction('request')}>
              Request from {detail.tool.holder.name}
            </Button>
          ) : null}
          {session && canStartHandoff && actionPolicy.canTransfer ? (
            <>
              <Button variant="primary" onClick={() => onAction('transfer')}>
                Transfer tool
              </Button>
              {actionPolicy.canReportCondition ? (
                <div className="detail-action-row">
                  <Button variant="danger" onClick={() => onAction('report-damaged')}>
                    Report damaged
                  </Button>
                  <Button variant="danger" onClick={() => onAction('report-lost')}>
                    Report lost
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
      {action ? (
        <section
          className={`detail-action-panel${action === 'transfer' ? ' detail-action-panel--transfer' : ''}`}
          aria-label="Action details"
        >
          <div className="detail-section-heading">
            <div>
              <span className="eyebrow">Confirm action</span>
              <h3>
                {action === 'request'
                  ? `Request from ${detail.tool.holder.name}`
                  : action === 'transfer'
                    ? 'Transfer'
                    : action === 'report-damaged'
                      ? 'Report damage'
                      : 'Report loss'}
              </h3>
            </div>
            <button type="button" className="text-button" onClick={onCloseAction}>
              Close
            </button>
          </div>
          {action === 'transfer' ? (
            targets.isPending || targets.isFetching || targets.isPaused ? (
              <LoadingState label="Loading transfer targets…" />
            ) : targets.isError ? (
              <ErrorState message="Transfer targets could not be loaded." />
            ) : (
              <TransferDestinationPicker
                candidates={targets.data ?? []}
                mode={activeTransferMode}
                target={target}
                onModeChange={onTransferModeChange}
                onTargetChange={onTargetChange}
              />
            )
          ) : null}
          {action === 'request' && requestUnits && requestUnits.length > 1 ? (
            <SelectField
              label="Warehouse"
              value={detail.tool.id}
              onChange={(value) => onRequestUnitChange?.(value)}
              options={requestUnits.map((unit) => ({
                value: unit.unitId,
                label: unit.warehouseName,
                description: `Unit ${unit.unitId}`,
              }))}
              placeholder="Choose a warehouse"
              searchable={false}
              presentation="sheet"
            />
          ) : null}
          {action !== 'transfer' || selectedTarget ? (
            <CustodyEvidenceFields
              className="detail-action-field"
              context={action === 'transfer' ? 'transfer' : action.startsWith('report-') ? 'condition' : 'request'}
              note={note}
              photo={photo}
              showPhoto={!isCheckoutRequest}
              onNoteChange={onNoteChange}
              onPhotoChange={onPhotoChange}
              onPhotoBusyChange={onPhotoBusyChange}
            />
          ) : null}
          <Button
            className={action === 'transfer' ? 'transfer-submit-button' : undefined}
            variant="primary"
            fullWidth
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {photoBusy
              ? 'Processing photo…'
              : busy || detailRefreshing
                ? 'Saving…'
                : action === 'transfer'
                  ? selectedTarget
                    ? `Send to ${selectedTarget.name}`
                    : 'Choose a destination'
                  : action === 'request'
                    ? `Request from ${detail.tool.holder.name}`
                    : action === 'report-damaged'
                      ? 'Report damage'
                      : 'Report loss'}
          </Button>
          {action === 'transfer' && selectedTarget ? (
            <p className="transfer-submit-note">
              {selectedTarget.type === 'warehouse'
                ? 'The warehouse manager accepts the return before it goes back in stock.'
                : 'Custody moves only when they accept. Expires in 48 hours.'}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
