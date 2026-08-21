import type { CustodyEvidence } from '../evidence';
import type { ActivityKind, ActivityScope } from '../activity';

export interface ActivityView {
  id: string;
  actorId: string;
  actor: string;
  action: string;
  toolUnitId: string;
  toolName: string;
  imageSrc: string;
  time: string;
  timestamp: string;
  kind: ActivityKind;
  scope: ActivityScope;
  participantIds: string[];
  warehouseId: string;
  warehouseName: string;
  evidence?: CustodyEvidence;
}

export interface AuditEventView {
  id: string;
  actorId: string;
  actor: string;
  action: string;
  toolUnitId?: string;
  scope: ActivityScope;
  toolName?: string;
  warehouseId?: string;
  warehouseName?: string;
  time: string;
  timestamp: string;
  kind: ActivityKind;
  evidence?: CustodyEvidence;
}
