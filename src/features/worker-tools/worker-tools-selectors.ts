import type { ToolView } from '../../domain/read-models/tools';
import { isFlaggedToolStatus } from '../../domain/tool';

export const toolsHeldBy = (tools: ToolView[], profileId: string) =>
  tools.filter((tool) => tool.holder.type === 'worker' && tool.holder.userId === profileId);

export const toolsNeedingAttention = (tools: ToolView[]) => tools.filter((tool) => isFlaggedToolStatus(tool.status));

export const toolsAvailableNow = (tools: ToolView[]) => tools.filter((tool) => tool.status === 'in-stock');

export const availableWarehouseCount = (tools: ToolView[]) =>
  new Set(
    toolsAvailableNow(tools).flatMap((tool) => (tool.holder.type === 'warehouse' ? [tool.holder.warehouseId] : [])),
  ).size;
