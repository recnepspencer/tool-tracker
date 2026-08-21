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

  return (
    <div className="worker-screen">
      <div className="worker-screen-heading">
        <div>
          <div className="worker-eyebrow">{session.name}</div>
          <h1>My tools</h1>
        </div>
      </div>
      <section className="worker-pending-section" aria-labelledby="pending-handoffs-heading">
        {pending.isPending ? <LoadingState label="Checking pending handoffs…" /> : null}
        {pending.isError ? <ErrorState message="Pending handoffs could not be loaded." /> : null}
        {pending.data?.map((handoff) => (
          <PendingHandoffCard
            key={handoff.id}
            handoff={handoff}
            profileId={session.profileId}
            queryBlocked={pending.isFetching || pending.isPaused || pending.isError}
          />
        ))}
      </section>
      <WorkerToolGrid
        tools={mine}
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
