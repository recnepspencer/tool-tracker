import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { SelectField } from '../../components/ui/SelectField';
import type { AuthSession } from '../../domain/auth';
import { workerCustodyActionPolicy } from '../../domain/custody-policy';
import type { ToolDetailView } from '../../domain/read-models/tools';
import type { ToolHolderView } from '../../domain/read-models/holder';
import { CustodyEvidenceFields } from '../custody/CustodyEvidenceFields';
import { holderSelectionKey } from './holder-selection-key';
import { toToolHolderRef } from './holder-ref';
import type { DetailAction } from './detail-action-types';

interface ToolCustodyActionsProps {
  detail: ToolDetailView;
  session: AuthSession | null;
  action: DetailAction | null;
  target: string;
  note: string;
  mockPhoto: boolean;
  canStartHandoff: boolean;
  detailRefreshing: boolean;
  busy: boolean;
  targets: { isPending: boolean; isFetching: boolean; isPaused: boolean; isError: boolean; data?: ToolHolderView[] };
  onAction(action: DetailAction): void;
  onTargetChange(target: string): void;
  onNoteChange(note: string): void;
  onMockPhotoChange(mockPhoto: boolean): void;
  onCloseAction(): void;
  onSubmit(): void;
}

export function ToolCustodyActions({
  detail,
  session,
  action,
  target,
  note,
  mockPhoto,
  canStartHandoff,
  detailRefreshing,
  busy,
  targets,
  onAction,
  onTargetChange,
  onNoteChange,
  onMockPhotoChange,
  onCloseAction,
  onSubmit,
}: ToolCustodyActionsProps) {
  const selectedTarget = targets.data?.find((candidate) => holderSelectionKey(candidate) === target);
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
    !(
      action === 'transfer' &&
      (targets.isPending || targets.isFetching || targets.isPaused || targets.isError || !selectedTarget)
    );
  return (
    <>
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
      {action ? (
        <section className="detail-action-panel" aria-label="Action details">
          <div className="detail-section-heading">
            <div>
              <span className="eyebrow">Confirm action</span>
              <h3>
                {action === 'request'
                  ? 'Request this tool'
                  : action === 'transfer'
                    ? 'Choose a destination'
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
              <SelectField
                label="Send to"
                value={target}
                onChange={onTargetChange}
                placeholder="Choose a person or warehouse"
                options={(targets.data ?? []).map((candidate) => ({
                  value: holderSelectionKey(candidate),
                  label: candidate.name,
                  description: candidate.type === 'warehouse' ? 'Warehouse' : 'Person',
                }))}
              />
            )
          ) : null}
          <CustodyEvidenceFields
            className="detail-action-field"
            note={note}
            mockPhoto={mockPhoto}
            onNoteChange={onNoteChange}
            onMockPhotoChange={onMockPhotoChange}
          />
          <Button variant="primary" fullWidth disabled={!canSubmit} onClick={onSubmit}>
            {busy || detailRefreshing ? 'Saving…' : 'Confirm'}
          </Button>
        </section>
      ) : null}
    </>
  );
}
