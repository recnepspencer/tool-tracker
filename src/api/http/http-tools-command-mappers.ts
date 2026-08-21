import type { ToolView } from '../../domain/read-models/tools';
import type { HolderRef } from '../../domain/custody';
import type { ToolDto } from './http-tool-types';
import { mapTool } from './http-tool-mappers';
import type { ConditionReportKind } from '../../domain/condition-report';
import type { ToolStatus } from '../../domain/tool';

/** Validate the tool receipt returned by the create command against its actor. */
export const mapCreatedTool = (dto: ToolDto, actorId: string): ToolView => {
  const tool = mapTool(dto);
  if (tool.status !== 'checked-out' || tool.holder.type !== 'worker' || tool.holder.userId !== actorId) {
    throw new Error('Invalid API response: created tool custody');
  }
  return tool;
};

const sameHolderIdentity = (left: ToolView['holder'], right: HolderRef) => {
  if (left.type === 'worker' && right.type === 'worker') return left.userId === right.userId;
  if (left.type === 'warehouse' && right.type === 'warehouse') return left.warehouseId === right.warehouseId;
  return false;
};

const mapAdvancedTool = (dto: ToolDto, expectedToolUnitId: string, expectedRevision: number): ToolView => {
  const tool = mapTool(dto);
  if (tool.id !== expectedToolUnitId) throw new Error('Invalid API response: updated tool id correlation');
  if (tool.revision <= expectedRevision) throw new Error('Invalid API response: updated tool revision');
  return tool;
};

export const mapUpdatedTool = (
  dto: ToolDto,
  expectedToolUnitId: string,
  expectedRevision: number,
  expectedStatus: ToolStatus,
  expectedHolder: HolderRef,
): ToolView => {
  const tool = mapAdvancedTool(dto, expectedToolUnitId, expectedRevision);
  if (tool.status !== expectedStatus) throw new Error('Invalid API response: updated tool status preservation');
  if (!sameHolderIdentity(tool.holder, expectedHolder)) {
    throw new Error('Invalid API response: updated tool holder preservation');
  }
  return tool;
};

export const mapFlaggedTool = (
  dto: ToolDto,
  expectedToolUnitId: string,
  condition: ConditionReportKind,
  expectedRevision: number,
  expectedHolder: HolderRef,
): ToolView => {
  const tool = mapAdvancedTool(dto, expectedToolUnitId, expectedRevision);
  if (tool.status !== condition) throw new Error('Invalid API response: flagged tool status');
  if (!sameHolderIdentity(tool.holder, expectedHolder)) {
    throw new Error('Invalid API response: flagged tool holder preservation');
  }
  return tool;
};

export const mapRestoredTool = (
  dto: ToolDto,
  expectedToolUnitId: string,
  expectedRevision: number,
  expectedHolder: HolderRef,
): ToolView => {
  const tool = mapAdvancedTool(dto, expectedToolUnitId, expectedRevision);
  if (tool.status !== 'in-stock') throw new Error('Invalid API response: restored tool status');
  if (!sameHolderIdentity(tool.holder, expectedHolder)) {
    throw new Error('Invalid API response: restored tool holder preservation');
  }
  return tool;
};
