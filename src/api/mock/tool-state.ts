import { WorkflowError } from '../../domain/workflow-error';
import { bumpToolRevision, toolRevision, type ToolDefinition, type ToolUnit } from '../../domain/tool';
import type { MockDatabaseState, SeedSnapshot, DeepReadonly } from './seed-state';

export function unitOrThrow(state: MockDatabaseState, toolUnitId: string): ToolUnit;
export function unitOrThrow(state: SeedSnapshot, toolUnitId: string): DeepReadonly<ToolUnit>;
export function unitOrThrow(state: SeedSnapshot, toolUnitId: string): ToolUnit | DeepReadonly<ToolUnit> {
  const unit = state.units.find((candidate) => candidate.id === toolUnitId);
  if (!unit) throw new WorkflowError('not-found', 'Tool unit not found: ' + toolUnitId);
  if (unit.lifecycle !== 'active') throw new WorkflowError('archived', 'Tool unit is archived: ' + toolUnitId);
  return unit;
}

export const toolName = (state: SeedSnapshot, toolUnitId: string) => {
  const unit = state.units.find((candidate) => candidate.id === toolUnitId);
  return state.definitions.find((definition) => definition.id === unit?.definitionId)?.name ?? 'tool';
};

export const assertExpectedRevision = (
  unit: Pick<ToolUnit, 'revision'>,
  expectedRevision: number,
  definition?: Pick<ToolDefinition, 'revision'>,
) => {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw new WorkflowError('invalid', 'Tool revision is invalid');
  }
  const currentRevision = toolRevision(unit, definition);
  if (expectedRevision !== currentRevision) {
    throw new WorkflowError('conflict', 'Tool changed before this decision; refresh and try again');
  }
};

export const bumpUnitRevision = (state: MockDatabaseState, unit: ToolUnit) =>
  bumpToolRevision(
    unit,
    state.definitions.find((definition) => definition.id === unit.definitionId),
  );
