import type { AuditEvent } from '../../domain/activity';
import type { CustodyEvidence } from '../../domain/evidence';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';

export const appendAuditEvent = (
  state: MockDatabaseState,
  database: MockDatabase,
  input: {
    actorId: string;
    action: string;
    toolUnitId?: string;
    kind: AuditEvent['kind'];
    scope: AuditEvent['scope'];
    participantIds: string[];
    warehouseId: string;
    occurredAt: string;
    evidence?: CustodyEvidence;
  },
) => {
  const event: AuditEvent = {
    id: database.nextId('EV'),
    actorId: input.actorId,
    action: input.action,
    ...(input.toolUnitId ? { toolUnitId: input.toolUnitId } : {}),
    kind: input.kind,
    scope: input.scope,
    participantIds: [...new Set(input.participantIds)],
    warehouseId: input.warehouseId,
    occurredAt: input.occurredAt,
    ...(input.evidence ? { evidence: input.evidence } : {}),
  };
  state.events.push(event);
  return event.id;
};
