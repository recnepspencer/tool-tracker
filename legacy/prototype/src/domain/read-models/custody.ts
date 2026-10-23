import type { HandoffAction, HandoffKind } from '../custody';
import type { CustodyEvidence } from '../evidence';
import type { ToolHolderView } from './holder';

export interface PendingHandoffView {
  id: string;
  kind: HandoffKind;
  toolUnitId: string;
  toolName: string;
  imageSrc: string;
  from: ToolHolderView;
  to: ToolHolderView;
  requestedById: string;
  requestedBy: string;
  requestedAt: string;
  requestedAtInstant: string;
  evidence?: CustodyEvidence;
  direction: 'incoming' | 'outgoing';
  canEdit: boolean;
  allowedActions: HandoffAction[];
}
