import type { HolderRef } from '../../domain/custody';
import type { ToolHolderView } from '../../domain/read-models/holder';

/** Reduce a derived holder view to the identity owned by tool commands/policy. */
export const toHolderRef = (holder: ToolHolderView): HolderRef =>
  holder.type === 'worker'
    ? { type: 'worker', userId: holder.userId }
    : { type: 'warehouse', warehouseId: holder.warehouseId };
