import type { HandoffKind } from '../../domain/custody';

export function pendingHandoffDirectionLabel(
  direction: 'incoming' | 'outgoing',
  kind: HandoffKind,
  otherParty: string,
) {
  if (direction === 'incoming') return `Accept from ${otherParty}`;
  return kind === 'warehouse-request' ? `Requested from ${otherParty}` : `Sent to ${otherParty}`;
}

export function pendingHandoffStatusLabel(direction: 'incoming' | 'outgoing', kind: HandoffKind, otherParty: string) {
  if (direction === 'incoming') return `${otherParty} sent this tool to you`;
  return kind === 'warehouse-request'
    ? `Waiting for ${otherParty} to release it`
    : `Waiting for ${otherParty} to accept`;
}
