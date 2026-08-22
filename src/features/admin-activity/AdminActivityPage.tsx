import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { PageHeading } from '../../components/layout/PageHeading';
import { useAdminAudit } from './use-admin-audit';
import { filterAuditEvents, type AuditKindFilter } from './activity-selectors';
import { AuditLog } from './AuditLog';
import { AuditLogFilters } from './AuditLogFilters';
import './admin-activity.css';
import { Button } from '../../components/ui/Button';

export function AdminActivityPage() {
  const audit = useAdminAudit();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<AuditKindFilter>('all');
  const [warehouseId, setWarehouseId] = useState('all');
  const events = useMemo(
    () => filterAuditEvents(audit.data ?? [], search, kind, warehouseId),
    [audit.data, kind, search, warehouseId],
  );
  if (audit.isPending) return <LoadingState label="Loading the audit log…" />;
  if (audit.isError || !audit.data)
    return <ErrorState message="The audit log could not be loaded." onRetry={() => void audit.refetch()} />;
  return (
    <div className="page-content admin-activity-page">
      <PageHeading
        eyebrow="Admin view · Governance"
        title="Audit log"
        description="Immutable operational history across tools, people, and settings."
        status="Read only"
      />
      <div className="admin-toolbar admin-toolbar--audit">
        <span className="section-count">{events.length} events</span>
        <Button variant="secondary" onClick={() => exportAuditLog(events)}>
          Export log
        </Button>
      </div>
      <AuditLogFilters
        events={audit.data}
        search={search}
        kind={kind}
        warehouseId={warehouseId}
        onSearchChange={setSearch}
        onKindChange={setKind}
        onWarehouseChange={setWarehouseId}
      />
      <AuditLog events={events} />
      <Link className="text-link" to="/admin/dashboard">
        Back to dashboard
      </Link>
    </div>
  );
}

function exportAuditLog(events: ReturnType<typeof filterAuditEvents>) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = events.map((event) =>
    [
      event.timestamp,
      event.actor,
      event.action,
      event.toolName ?? '',
      event.toolUnitId ?? '',
      event.warehouseName ?? '',
      event.kind,
    ]
      .map(quote)
      .join(','),
  );
  const blob = new Blob([['Timestamp,Actor,Action,Tool,Unit,Warehouse,Kind', ...rows].join('\n')], {
    type: 'text/csv',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nelson-electric-audit.csv';
  link.click();
  URL.revokeObjectURL(url);
}
