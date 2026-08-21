import type { CreateToolInput, FlagToolInput, RestoreToolInput, UpdateToolInput } from './contracts/tools-api';
import type { ConditionReportKind } from '../domain/condition-report';
import { CONDITION_REPORTS } from '../domain/condition-report';
import { normalizeEvidence, normalizeExpectedRevision, optionalText, requiredText } from './command-normalization';

const normalizeCondition = (value: unknown): ConditionReportKind => {
  if (typeof value !== 'string' || !CONDITION_REPORTS.includes(value as ConditionReportKind)) {
    throw new Error('Condition must be damaged or lost');
  }
  return value as ConditionReportKind;
};

export const normalizeCreateToolInput = (input: CreateToolInput): CreateToolInput => {
  const serial = optionalText(input.serial);
  const price = optionalText(input.price);
  return {
    actorId: input.actorId.trim(),
    warehouseId: input.warehouseId.trim(),
    definition: {
      name: input.definition.name.trim(),
      brand: input.definition.brand.trim(),
      model: input.definition.model.trim(),
      categoryId: requiredText(input.definition.categoryId, 'Tool category'),
      ...(input.definition.category ? { category: input.definition.category.trim() } : {}),
      imageKey: input.definition.imageKey.trim(),
    },
    photoCaptured: input.photoCaptured,
    ...(serial ? { serial } : {}),
    ...(price ? { price } : {}),
    ...(input.evidence ? normalizeEvidence({ evidence: input.evidence }) : {}),
  };
};

export const normalizeUpdateToolInput = (input: UpdateToolInput): UpdateToolInput => {
  const serial = optionalText(input.serial);
  const price = optionalText(input.price);
  return {
    actorId: input.actorId.trim(),
    toolUnitId: input.toolUnitId.trim(),
    expectedRevision: normalizeExpectedRevision(input.expectedRevision),
    expectedStatus: input.expectedStatus,
    expectedHolder:
      input.expectedHolder.type === 'worker'
        ? {
            type: 'worker',
            userId: requiredText(input.expectedHolder.userId, 'Expected worker'),
          }
        : {
            type: 'warehouse',
            warehouseId: requiredText(input.expectedHolder.warehouseId, 'Expected warehouse'),
          },
    definition: {
      name: input.definition.name.trim(),
      brand: input.definition.brand.trim(),
      model: input.definition.model.trim(),
      categoryId: requiredText(input.definition.categoryId, 'Tool category'),
      ...(input.definition.category ? { category: input.definition.category.trim() } : {}),
      imageKey: input.definition.imageKey.trim(),
    },
    ...(serial ? { serial } : {}),
    ...(price ? { price } : {}),
    ...(input.evidence ? normalizeEvidence({ evidence: input.evidence }) : {}),
  };
};

export const normalizeFlagToolInput = (input: FlagToolInput): FlagToolInput =>
  normalizeEvidence({
    ...input,
    actorId: input.actorId.trim(),
    toolUnitId: input.toolUnitId.trim(),
    expectedRevision: normalizeExpectedRevision(input.expectedRevision),
    expectedHolder:
      input.expectedHolder.type === 'worker'
        ? {
            type: 'worker',
            userId: requiredText(input.expectedHolder.userId, 'Expected worker'),
          }
        : {
            type: 'warehouse',
            warehouseId: requiredText(input.expectedHolder.warehouseId, 'Expected warehouse'),
          },
    condition: normalizeCondition(input.condition),
  });

export const normalizeRestoreToolInput = (input: RestoreToolInput): RestoreToolInput =>
  normalizeEvidence({
    ...input,
    actorId: input.actorId.trim(),
    toolUnitId: input.toolUnitId.trim(),
    expectedRevision: normalizeExpectedRevision(input.expectedRevision),
    expectedHolder:
      input.expectedHolder.type === 'worker'
        ? {
            type: 'worker',
            userId: requiredText(input.expectedHolder.userId, 'Expected worker'),
          }
        : {
            type: 'warehouse',
            warehouseId: requiredText(input.expectedHolder.warehouseId, 'Expected warehouse'),
          },
  });
