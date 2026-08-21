import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/session-context';
import { LoadingState, ErrorState } from '../../components/ui/AsyncState';
import { Button } from '../../components/ui/Button';
import { MetricCard } from '../../components/ui/MetricCard';
import { MetricGrid } from '../../components/layout/MetricGrid';
import { PageHeading } from '../../components/layout/PageHeading';
import { Callout } from '../../components/ui/Callout';
import { WorkerToolDetailSheet } from '../tool-detail/WorkerToolDetailSheet';
import { WorkerToolGrid } from './WorkerToolGrid';
import { usePendingHandoffs } from '../custody/use-custody-queries';
import { useWorkerTools } from './use-worker-tools';
import { PendingHandoffCard } from '../custody/PendingHandoffCard';
import { AddToolWizard } from '../add-tool/AddToolWizard';
import {
  availableWarehouseCount,
  toolsAvailableNow,
  toolsHeldBy,
  toolsNeedingAttention,
} from './worker-tools-selectors';
import '../../styles/worker.css';
import '../../styles/section-heading.css';

export function WorkerToolsPage() {
  const { session } = useSession();
  const tools = useWorkerTools();
  const pending = usePendingHandoffs();
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [addToolOpen, setAddToolOpen] = useState(false);
  if (!session) return null;
  if (tools.isPending) return <LoadingState label="Loading your tools…" />;
  if (tools.isError || !tools.data) return <ErrorState message="Your tools could not be loaded." />;

  const mine = toolsHeldBy(tools.data, session.profileId);
  const flagged = toolsNeedingAttention(mine);
  const available = toolsAvailableNow(tools.data);
  const availableYards = availableWarehouseCount(tools.data);

  return (
    <div className="page-content">
      <PageHeading
        eyebrow="Worker view · Field"
        title="My tools"
        description="Everything currently in your custody, with its latest movement on the record."
        status="Demo data"
      />
      <MetricGrid>
        <MetricCard label="In my custody" value={mine.length} detail="tools" tone="blue" />
        <MetricCard
          label="Available now"
          value={available.length}
          detail={'across ' + availableYards + ' yards'}
          tone="green"
        />
        <MetricCard
          label="Needs attention"
          value={flagged.length}
          detail="reported condition"
          tone={flagged.length ? 'amber' : 'default'}
        />
      </MetricGrid>
      <WorkerToolGrid tools={mine} onSelect={setSelectedToolId} />
      <div className="worker-tool-actions">
        <Button variant="secondary" onClick={() => setAddToolOpen(true)}>
          Add a tool
        </Button>
      </div>
      <section className="section-block pending-handoffs" aria-labelledby="pending-handoffs-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Requests in motion</span>
            <h2 id="pending-handoffs-heading">Pending handoffs</h2>
          </div>
          <span className="section-count">{pending.data?.length ?? 0}</span>
        </div>
        {pending.isPending ? <LoadingState label="Checking pending handoffs…" /> : null}
        {pending.isError ? <ErrorState message="Pending handoffs could not be loaded." /> : null}
        {pending.data?.length === 0 ? <p className="empty-copy">No handoffs are waiting for your response.</p> : null}
        {pending.data?.map((handoff) => (
          <PendingHandoffCard
            key={handoff.id}
            handoff={handoff}
            profileId={session.profileId}
            queryBlocked={pending.isFetching || pending.isPaused || pending.isError}
          />
        ))}
      </section>
      <Callout
        eyebrow="Find another unit"
        title="Browse the checkout catalog when you need a tool from another yard."
        description="Search by tool, warehouse, category, or availability, then open the custody record before you request a handoff."
      />
      <Link className="button button--secondary worker-checkout-link" to="/worker/checkout">
        Browse checkout catalog
      </Link>
      <WorkerToolDetailSheet toolUnitId={selectedToolId} onClose={() => setSelectedToolId(null)} />
      {addToolOpen ? <AddToolWizard onClose={() => setAddToolOpen(false)} /> : null}
    </div>
  );
}
