import type { HandoffRequest } from './custody';

export type WarehouseQueueKind = 'request' | 'return';

export const classifyWarehouseQueueItem = (
  handoff: Pick<HandoffRequest, 'kind' | 'from' | 'to'>,
): WarehouseQueueKind | null =>
  handoff.kind === 'warehouse-request' && handoff.from.type === 'warehouse' && handoff.to.type === 'worker'
    ? 'request'
    : handoff.kind === 'transfer' && handoff.from.type === 'worker' && handoff.to.type === 'warehouse'
      ? 'return'
      : null;
