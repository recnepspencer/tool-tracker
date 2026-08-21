import type { HolderRef } from '../../domain/custody';
import type { ToolHolderView } from '../../domain/read-models/holder';

export const toHolderView = (
  holder: HolderRef,
  userNames: Map<string, string>,
  warehouseNames: Map<string, string>,
): ToolHolderView =>
  holder.type === 'worker'
    ? { type: 'worker', userId: holder.userId, name: userNames.get(holder.userId) ?? 'Unknown worker' }
    : {
        type: 'warehouse',
        warehouseId: holder.warehouseId,
        name: warehouseNames.get(holder.warehouseId) ?? 'Unknown warehouse',
      };
