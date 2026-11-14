import type { ActivityRow } from './activity-state';
import { formatDate, sentence } from './format';

const titles: Record<string, string> = {
  'companies.company.created': 'Company created',
  'companies.company.updated': 'Company profile updated',
  'companies.membership.updated': 'Team access updated',
  'companies.invitation.created': 'Invitation sent',
  'companies.invitation.accepted': 'Invitation accepted',
  'companies.invitation.revoked': 'Invitation revoked',
  'equipment.tool.requested': 'Tool requested',
  'equipment.request.approved': 'Request approved',
  'equipment.request.rejected': 'Request rejected',
  'equipment.request.withdrawn': 'Request withdrawn',
  'equipment.handoff.proposed': 'Handoff proposed',
  'equipment.handoff.accepted': 'Tool received',
  'equipment.handoff.declined': 'Receipt declined',
  'equipment.handoff.cancelled': 'Handoff cancelled',
  'equipment.incident.reported': 'Problem reported',
  'equipment.incident.found': 'Missing tool found',
  'equipment.asset.serviced': 'Service recorded',
  'equipment.asset.lifecycle_changed': 'Tool lifecycle updated',
  'equipment.asset.registered': 'Tool registered',
  'equipment.asset.updated': 'Tool details updated',
  'equipment.asset.stewardship_changed': 'Responsible warehouse changed',
  'equipment.warehouse.created': 'Warehouse created',
  'equipment.warehouse.updated': 'Warehouse updated',
  'equipment.warehouse.authority_changed': 'Warehouse authority updated',
  'equipment.model.created': 'Tool model created',
  'equipment.model.updated': 'Tool model updated',
  'equipment.category.created': 'Category created',
  'equipment.category.updated': 'Category updated',
  'equipment.registration_policy.updated': 'Field inventory collection rule updated',
  'equipment.submission.created': 'Equipment submitted for review',
  'equipment.submission.replied': 'Equipment clarification received',
  'equipment.submission.reviewed': 'Equipment submission reviewed',
  'equipment.reconciliation.opened': 'Reconciliation opened',
  'equipment.reconciliation.resolved': 'Reconciliation resolved',
  'equipment.reconciliation.merged': 'Duplicate record merged',
  'work.project.created': 'Project created',
  'work.project.updated': 'Project updated',
  'work.job.created': 'Job created',
  'work.job.updated': 'Job updated',
  'work.assignment.created': 'Person assigned to job',
  'work.assignment.ended': 'Job assignment ended',
  'work.participation_policy.updated': 'Job participation rules updated',
  'work.participation.requested': 'Job participation requested',
  'work.participation.approved': 'Job participation approved',
  'work.participation.rejected': 'Job participation rejected',
  'work.participation.withdrawn': 'Job participation withdrawn',
};

/** Unknown keys fall back to sentence case rather than raw lowercase words. */
export const activityTitle = (key: string) => titles[key] ?? sentence(key.split('.').slice(1).join(' '));

/** The demo's activity kinds. The groups mirror the server's `kind` filter. */
export type ActivityKind = 'custody' | 'request' | 'flag' | 'admin';

export function activityKind(key: string): ActivityKind {
  if (key.startsWith('equipment.handoff.') || key.startsWith('equipment.reconciliation.')) return 'custody';
  if (key === 'equipment.tool.requested' || key.startsWith('equipment.request.')) return 'request';
  if (key.startsWith('equipment.incident.') || key === 'equipment.asset.serviced') return 'flag';
  if (key.startsWith('equipment.asset.lifecycle')) return 'flag';
  return 'admin';
}

/** Worker feed tag copy (demo `ActivityFeed.activityLabel`). */
export const activityTag: Record<ActivityKind, string> = {
  request: 'Request',
  flag: 'Condition',
  custody: 'Custody',
  admin: 'Record',
};

/** Groups newest-first events by calendar day, keeping server order inside each day. */
export function groupByDay<T extends { occurred_at: string }>(items: T[], label = formatDate) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const day = label(item.occurred_at);
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return [...groups.entries()].map(([day, events]) => ({ label: day, items: events }));
}

/** Text metadata value, or undefined. */
export const metaText = (metadata: Record<string, unknown>, key: string) =>
  typeof metadata[key] === 'string' && metadata[key] ? (metadata[key] as string) : undefined;

/** Demo "Export log": the loaded audit rows as CSV. */
export function exportAuditLog(rows: ActivityRow[]) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = rows.map((row) =>
    [row.occurredAt, row.actor, row.action, row.toolName ?? '', row.unit ?? '', row.warehouseName ?? '', row.kind]
      .map(quote)
      .join(','),
  );
  const blob = new Blob([['Timestamp,Actor,Action,Tool,Unit,Warehouse,Kind', ...lines].join('\n')], {
    type: 'text/csv',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nelson-electric-audit.csv';
  link.click();
  URL.revokeObjectURL(url);
}
