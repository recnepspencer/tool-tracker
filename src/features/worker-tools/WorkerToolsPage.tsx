import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/session-context';
import { LoadingState, ErrorState } from '../../components/ui/AsyncState';
import { WorkerToolDetailSheet } from '../tool-detail/WorkerToolDetailSheet';
import { WorkerToolGrid } from './WorkerToolGrid';
import { usePendingHandoffs } from '../custody/use-custody-queries';
import { useWorkerTools } from './use-worker-tools';
import { PendingHandoffCard } from '../custody/PendingHandoffCard';
import type { DetailAction } from '../tool-detail/detail-action-types';
import { toolsHeldBy } from './worker-tools-selectors';
import '../../styles/worker.css';

export function WorkerToolsPage() {
  const { session } = useSession();
  const tools = useWorkerTools();
  const pending = usePendingHandoffs();
  const [selectedTool, setSelectedTool] = useState<{ id: string; action?: DetailAction } | null>(null);
  if (!session) return null;
  if (tools.isPending) return <LoadingState label="Loading your tools…" />;
  if (tools.isError || !tools.data) return <ErrorState message="Your tools could not be loaded." />;

  const mine = toolsHeldBy(tools.data, session.profileId);
  const needsResponse = pending.data?.filter(
    (handoff) => handoff.direction === 'incoming' && handoff.kind !== 'warehouse-request',
  );
  const waiting = pending.data?.filter(
    (handoff) => handoff.direction !== 'incoming' || handoff.kind === 'warehouse-request',
  );
  const pendingToolUnitIds = new Set(pending.data?.map((handoff) => handoff.toolUnitId) ?? []);
  const transferStatus = pending.isError
    ? 'unavailable'
    : pending.isPending || pending.isFetching || pending.isPaused || !pending.data
      ? 'checking'
      : 'ready';

  return (
    <div className="worker-screen">
      <div className="worker-screen-heading">
        <div>
          <div className="worker-eyebrow">{session.name}</div>
          <h1>My tools</h1>
        </div>
      </div>
      <section className="worker-pending-section" aria-label="Pending tool movements">
        {pending.isPending ? <LoadingState label="Checking pending handoffs…" /> : null}
        {pending.isError ? <ErrorState message="Pending handoffs could not be loaded." /> : null}
        {needsResponse?.length ? (
          <PendingGroup
            title="Needs your response"
            handoffs={needsResponse}
            profileId={session.profileId}
            queryBlocked={pending.isFetching || pending.isPaused || pending.isError}
          />
        ) : null}
        {waiting?.length ? (
          <PendingGroup
            title="Waiting on someone else"
            handoffs={waiting}
            profileId={session.profileId}
            queryBlocked={pending.isFetching || pending.isPaused || pending.isError}
          />
        ) : null}
      </section>
      <WorkerToolGrid
        tools={mine}
        pendingToolUnitIds={pendingToolUnitIds}
        transferStatus={transferStatus}
        onSelect={(id) => setSelectedTool({ id })}
        onTransfer={(id) => setSelectedTool({ id, action: 'transfer' })}
      />
      <Link className="worker-checkout-pill" to="/worker/checkout" aria-label="Browse checkout catalog">
        Need something else? Browse checkout
      </Link>
      <WorkerToolDetailSheet
        toolUnitId={selectedTool?.id ?? null}
        initialAction={selectedTool?.action ?? null}
        onClose={() => setSelectedTool(null)}
      />
    </div>
  );
}

function PendingGroup({
  title,
  handoffs,
  profileId,
  queryBlocked,
}: {
  title: string;
  handoffs: NonNullable<ReturnType<typeof usePendingHandoffs>['data']>;
  profileId: string;
  queryBlocked: boolean;
}) {
  return (
    <div className="worker-pending-group">
      <h2>{title}</h2>
      <div className="worker-pending-grid">
        {handoffs.map((handoff) => (
          <PendingHandoffCard key={handoff.id} handoff={handoff} profileId={profileId} queryBlocked={queryBlocked} />
        ))}
      </div>
    </div>
  );
}
