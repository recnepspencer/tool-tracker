import type { HolderRef } from './custody';
import type { ToolUnit } from './tool';

/** One authority for the warehouse currently responsible for a tool unit. */
export const currentWarehouseForUnit = (unit: Pick<ToolUnit, 'assignedWarehouseId'>, holder?: HolderRef) =>
  holder?.type === 'warehouse' ? holder.warehouseId : unit.assignedWarehouseId;
