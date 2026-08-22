import type { HandoffKind } from '../../domain/custody';

export function pendingHandoffDirectionLabel(direction: 'incoming' | 'outgoing', kind: HandoffKind) {
  if (direction === 'incoming') return 'Incoming transfer';
  return kind === 'warehouse-request' ? 'Tool request' : 'Outgoing transfer';
}

export function pendingHandoffStatusLabel(direction: 'incoming' | 'outgoing', kind: HandoffKind) {
  if (direction === 'incoming') return 'Needs your acceptance';
  return kind === 'warehouse-request' ? 'Awaiting warehouse approval' : 'Awaiting acceptance';
}
