export type ToolHolderView =
  { type: 'worker'; userId: string; name: string } | { type: 'warehouse'; warehouseId: string; name: string };
