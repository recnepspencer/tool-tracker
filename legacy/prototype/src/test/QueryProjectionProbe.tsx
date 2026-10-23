import { useSession } from '../app/session-context';
import { useAdminSummary } from '../features/admin-dashboard/use-admin-summary';
import { usePendingHandoffs, useTransferTargets } from '../features/custody/use-custody-queries';
import { useToolDetail } from '../features/tool-detail/use-tool-detail';
import { useToolCatalog } from '../features/worker-catalog/use-tool-catalog';
import { useWorkerActivity } from '../features/worker-activity/use-worker-activity';
import { useWorkerTools } from '../features/worker-tools/use-worker-tools';

export function QueryProjectionProbe({
  toolUnitId,
  pendingProfileId,
}: {
  toolUnitId: string;
  pendingProfileId?: string;
}) {
  const { session } = useSession();
  const catalog = useToolCatalog();
  const detail = useToolDetail(toolUnitId);
  const activity = useWorkerActivity();
  const adminSummary = useAdminSummary();
  const pending = usePendingHandoffs();
  const secondaryPending = usePendingHandoffs(pendingProfileId);
  const targets = useTransferTargets(session?.profileId ?? null, toolUnitId);
  const tools = useWorkerTools();
  const ready = [tools, catalog, detail, activity, adminSummary, pending, targets, secondaryPending].every(
    (query) => query.isSuccess,
  );
  const catalogUnit = catalog.data?.flatMap((item) => item.units).find((unit) => unit.id === toolUnitId);
  return (
    <output
      data-testid="projection-probe"
      data-tool-count={catalog.data?.reduce((count, item) => count + item.unitIds.length, 0) ?? ''}
      data-worker-tool-count={
        tools.data?.filter((tool) => tool.holder.type === 'worker' && tool.holder.userId === session?.profileId)
          .length ?? ''
      }
      data-worker-tool-status={tools.data?.find((tool) => tool.id === toolUnitId)?.status ?? ''}
      data-catalog-count={catalog.data?.length ?? ''}
      data-detail-holder={detail.data?.tool.holder.name ?? ''}
      data-detail-condition={detail.data?.condition ?? ''}
      data-detail-status={detail.data?.tool.status ?? ''}
      data-catalog-status={catalogUnit?.status ?? ''}
      data-activity-count={activity.data?.length ?? ''}
      data-admin-recent-count={adminSummary.data?.recentEvents.length ?? ''}
      data-admin-flagged-count={adminSummary.data?.flagged ?? ''}
      data-pending-count={pending.data?.length ?? ''}
      data-secondary-pending-count={secondaryPending.data?.length ?? ''}
      data-target-count={targets.data?.length ?? ''}
    >
      {ready ? 'ready' : 'loading'}
    </output>
  );
}
