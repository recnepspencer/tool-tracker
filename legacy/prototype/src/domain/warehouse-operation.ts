export const WAREHOUSE_OPERATION_TYPES = [
  'approve-request',
  'accept-return',
  'decline-queue-item',
  'return-tool',
  'decommission-tool',
] as const;
export type WarehouseOperationType = (typeof WAREHOUSE_OPERATION_TYPES)[number];

export interface WarehouseMutationReceipt {
  operation: WarehouseOperationType;
  correlationId: string;
  eventId: string;
  toolUnitId?: string;
  handoffId?: string;
  affectedToolUnitIds: string[];
  affectedHandoffIds: string[];
}
