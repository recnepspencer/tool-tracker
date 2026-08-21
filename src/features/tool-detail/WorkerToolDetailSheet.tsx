import { useSession } from '../../app/session-context';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ToolPhoto } from '../../components/ui/ToolPhoto';
import { usePendingHandoffs, useTransferTargets } from '../custody/use-custody-queries';
import { useToolDetail } from './use-tool-detail';
import { CustodyTimeline } from './CustodyTimeline';
import { ToolCustodyActions } from './ToolCustodyActions';
import { ToolMetadata } from './ToolMetadata';
import { useWorkerDetailActionController } from './use-worker-detail-action-controller';
import '../../styles/tool-detail.css';
import '../../styles/activity-indicator.css';

/** Worker-only detail composition; admin/warehouse surfaces should use a read-only detail shell. */
export function WorkerToolDetailSheet({ toolUnitId, onClose }: { toolUnitId: string | null; onClose(): void }) {
  const detail = useToolDetail(toolUnitId);
  const { session } = useSession();
  const pending = usePendingHandoffs();
  const targets = useTransferTargets(session?.profileId ?? null, toolUnitId);
  const canStartHandoff =
    Boolean(toolUnitId) &&
    !detail.isPending &&
    !detail.isFetching &&
    !detail.isPaused &&
    !pending.isPending &&
    !pending.isFetching &&
    !pending.isPaused &&
    !pending.isError &&
    !(toolUnitId ? (pending.data?.some((handoff) => handoff.toolUnitId === toolUnitId) ?? false) : false);
  const controller = useWorkerDetailActionController({
    toolUnitId,
    detail,
    targets,
    session,
    canStartHandoff,
  });

  if (!toolUnitId) return null;
  return (
    <OverlayDialog
      label="Tool details"
      onClose={onClose}
      backdropClassName="sheet-backdrop"
      panelClassName="detail-sheet"
    >
      <div className="detail-sheet-header">
        <span className="eyebrow">Tool details</span>
        <button type="button" className="icon-button" aria-label="Close tool details" onClick={onClose}>
          ×
        </button>
      </div>
      {detail.isPending ? <LoadingState label="Loading tool details…" /> : null}
      {detail.isError ? <ErrorState message="This tool detail could not be loaded." /> : null}
      {!detail.isPending && !detail.isError && detail.data ? (
        <div className="detail-sheet-content">
          <div className="detail-hero">
            <ToolPhoto src={detail.data.tool.imageSrc} alt={`${detail.data.tool.name} product photo`} size="large" />
            <div>
              <h2>{detail.data.tool.name}</h2>
              <p>
                {detail.data.tool.brand} · {detail.data.tool.model}
              </p>
              <StatusBadge status={detail.data.tool.status} />
            </div>
          </div>
          {controller.notice ? (
            <p className="detail-action-notice" role="status">
              {controller.notice}
            </p>
          ) : null}
          {controller.error ? (
            <p className="detail-action-error" role="alert">
              {controller.error}
            </p>
          ) : null}
          <ToolCustodyActions
            detail={detail.data}
            session={session}
            action={controller.action}
            target={controller.target}
            note={controller.note}
            mockPhoto={controller.mockPhoto}
            canStartHandoff={canStartHandoff}
            detailRefreshing={controller.detailRefreshing}
            busy={controller.busy}
            targets={targets}
            onAction={controller.onAction}
            onTargetChange={controller.onTargetChange}
            onNoteChange={controller.onNoteChange}
            onMockPhotoChange={controller.onMockPhotoChange}
            onCloseAction={controller.onCloseAction}
            onSubmit={() => void controller.submit()}
          />
          <ToolMetadata detail={detail.data} />
          <CustodyTimeline events={detail.data.timeline} />
        </div>
      ) : null}
    </OverlayDialog>
  );
}
