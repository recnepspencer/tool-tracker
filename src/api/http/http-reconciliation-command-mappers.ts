import type { HolderRef } from '../../domain/custody';

export const holderBody = (holder: HolderRef) =>
  holder.type === 'worker' ? { kind: 'worker', id: holder.userId } : { kind: 'warehouse', id: holder.warehouseId };
