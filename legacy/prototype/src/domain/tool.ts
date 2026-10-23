import type { HolderRef } from './custody';

export const TOOL_CONDITIONS = ['serviceable', 'damaged', 'lost'] as const;
export type ToolCondition = (typeof TOOL_CONDITIONS)[number];

export const TOOL_LIFECYCLES = ['active', 'archived'] as const;
export type ToolLifecycle = (typeof TOOL_LIFECYCLES)[number];

export const TOOL_STATUSES = ['in-stock', 'checked-out', 'damaged', 'lost'] as const;
export type ToolStatus = (typeof TOOL_STATUSES)[number];

/** A flagged unit cannot be treated as serviceable inventory. */
export const isFlaggedToolStatus = (status: ToolStatus) => status === 'damaged' || status === 'lost';

export interface ToolDefinition {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  /** Stable category authority ID. The label is a denormalized display snapshot. */
  categoryId: string;
  imageKey: string;
  /** Shared-definition optimistic-concurrency token; legacy seeds default to 1. */
  revision?: number;
}

export interface ToolUnit {
  id: string;
  definitionId: string;
  condition: ToolCondition;
  lifecycle: ToolLifecycle;
  originWarehouseId: string;
  /** The warehouse responsible for the unit's current assignment; origin is immutable provenance. */
  assignedWarehouseId: string;
  photoKey?: string;
  serial?: string;
  price?: string;
  /** Monotonic optimistic-concurrency token; legacy seeds default to 1. */
  revision?: number;
}

/** Derive command-safe status from domain state; read projections must not be authority. */
export const deriveToolStatus = (unit: Pick<ToolUnit, 'condition'>, holder: HolderRef): ToolStatus =>
  unit.condition === 'lost'
    ? 'lost'
    : unit.condition === 'damaged'
      ? 'damaged'
      : holder.type === 'worker'
        ? 'checked-out'
        : 'in-stock';

export const toolRevision = (unit: Pick<ToolUnit, 'revision'>, definition?: Pick<ToolDefinition, 'revision'>) =>
  Math.max(unit.revision ?? 1, definition?.revision ?? 1);

export const bumpToolRevision = (unit: ToolUnit, definition?: ToolDefinition) => {
  const nextRevision = toolRevision(unit, definition) + 1;
  unit.revision = nextRevision;
  if (definition) definition.revision = nextRevision;
};
