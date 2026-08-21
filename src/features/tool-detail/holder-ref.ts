import type { HolderRef } from '../../domain/custody';
import type { ToolHolderView } from '../../domain/read-models/holder';

/** Keep detail read-model labels at the feature boundary; domain policy consumes identity only. */
export const toToolHolderRef = (holder: ToolHolderView): HolderRef =>
  holder.type === 'worker'
    ? { type: 'worker', userId: holder.userId }
    : { type: 'warehouse', warehouseId: holder.warehouseId };
