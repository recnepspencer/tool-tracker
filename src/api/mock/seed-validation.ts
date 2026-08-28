import { ACTIVITY_KINDS, ACTIVITY_SCOPES, parseCanonicalInstant } from '../../domain/activity';
import { CONDITION_REPORTS } from '../../domain/condition-report';
import { HANDOFF_KINDS, HANDOFF_STATUSES } from '../../domain/custody';
import { sameHolder } from '../../domain/custody-policy';
import { TOOL_CONDITIONS, TOOL_LIFECYCLES } from '../../domain/tool';
import { DEMO_ROLES, MEMBER_LIFECYCLES, MEMBER_ROLES } from '../../domain/people';
import { isEligibleWarehouseManager } from '../../domain/warehouse';
import { normalizeCategoryName } from '../../domain/organization';
import type { MockDatabaseState } from './seed-state';

interface ReferenceIndex {
  userIds: Set<string>;
  warehouseIds: Set<string>;
  definitionIds: Set<string>;
  unitIds: Set<string>;
  activeUnitIds: Set<string>;
  categoryIds: Set<string>;
}

const assertUniqueIds = (values: Array<{ id: string }>, label: string) => {
  const ids = new Set<string>();
  values.forEach((value) => {
    if (!nonBlank(value.id)) throw new Error('Invalid ' + label + ': ' + value.id);
    if (ids.has(value.id)) throw new Error('Duplicate ' + label + ': ' + value.id);
    ids.add(value.id);
  });
};

const assertUniqueValues = (values: string[], label: string) => {
  if (new Set(values).size !== values.length) throw new Error('Duplicate ' + label);
};

const nonBlank = (value: string) => value.trim().length > 0;

const assertEvidence = (
  evidence: { note?: string; photo?: { fileName: string; src: string } } | undefined,
  label: string,
) => {
  if (evidence?.note !== undefined && !nonBlank(evidence.note)) throw new Error('Invalid ' + label + ' note');
  if (evidence?.photo !== undefined && (!nonBlank(evidence.photo.fileName) || !nonBlank(evidence.photo.src))) {
    throw new Error('Invalid ' + label + ' photo');
  }
};

const assertCollectionIdentity = (state: MockDatabaseState) => {
  assertUniqueIds(state.users, 'user');
  assertUniqueIds(state.warehouses, 'warehouse');
  assertUniqueIds(state.definitions, 'tool definition');
  assertUniqueIds(state.units, 'tool unit');
  assertUniqueIds(state.handoffs, 'handoff');
  assertUniqueIds(state.conditionReports, 'condition report');
  assertUniqueIds(state.events, 'audit event');
  assertUniqueIds(state.categories, 'tool category');
  if (
    state.company.id !== 'company' ||
    !nonBlank(state.company.name) ||
    !nonBlank(state.company.address) ||
    state.company.revision < 1
  ) {
    throw new Error('Invalid company profile');
  }
  const normalizedCategories = state.categories.map((category) => normalizeCategoryName(category.name));
  if (
    normalizedCategories.some((name) => !name) ||
    new Set(normalizedCategories).size !== normalizedCategories.length
  ) {
    throw new Error('Invalid tool categories');
  }
  state.categories.forEach((category, index) => {
    if (category.normalizedName !== normalizedCategories[index] || category.revision < 1) {
      throw new Error('Invalid tool category: ' + category.id);
    }
  });
  state.users.forEach((user) => {
    if (!nonBlank(user.name) || !nonBlank(user.email) || !nonBlank(user.title)) {
      throw new Error('Invalid user: ' + user.id);
    }
  });
  state.warehouses.forEach((warehouse) => {
    if (!nonBlank(warehouse.name) || !nonBlank(warehouse.address)) {
      throw new Error('Invalid warehouse: ' + warehouse.id);
    }
  });
  state.definitions.forEach((definition) => {
    if (
      !nonBlank(definition.name) ||
      !nonBlank(definition.brand) ||
      !nonBlank(definition.model) ||
      !nonBlank(definition.category) ||
      !nonBlank(definition.imageKey)
    ) {
      throw new Error('Invalid tool definition: ' + definition.id);
    }
  });
};

const buildReferenceIndex = (state: MockDatabaseState): ReferenceIndex => ({
  userIds: new Set(state.users.map((user) => user.id)),
  warehouseIds: new Set(state.warehouses.map((warehouse) => warehouse.id)),
  definitionIds: new Set(state.definitions.map((definition) => definition.id)),
  unitIds: new Set(state.units.map((unit) => unit.id)),
  activeUnitIds: new Set(state.units.filter((unit) => unit.lifecycle === 'active').map((unit) => unit.id)),
  categoryIds: new Set(state.categories.map((category) => category.id)),
});

const assertDemoProfiles = (state: MockDatabaseState, refs: ReferenceIndex) => {
  assertUniqueValues(state.demoProfileIds, 'demo profile id');
  state.demoProfileIds.forEach((profileId) => {
    const user = state.users.find((candidate) => candidate.id === profileId);
    if (!refs.userIds.has(profileId) || !user || !DEMO_ROLES.includes(user.role as (typeof DEMO_ROLES)[number])) {
      throw new Error('Unknown demo profile: ' + profileId);
    }
    if (user.lifecycle !== 'active') throw new Error('Inactive demo profile: ' + profileId);
  });
};

const assertUserAndWarehouseReferences = (state: MockDatabaseState, refs: ReferenceIndex) => {
  state.users.forEach((user) => {
    if (!MEMBER_ROLES.includes(user.role) || !MEMBER_LIFECYCLES.includes(user.lifecycle) || !nonBlank(user.email)) {
      throw new Error('Invalid user: ' + user.id);
    }
    if (!refs.warehouseIds.has(user.homeWarehouseId))
      throw new Error('Unknown home warehouse: ' + user.homeWarehouseId);
  });
  state.warehouses.forEach((warehouse) => {
    const manager = state.users.find((user) => user.id === warehouse.managerId);
    if (!refs.userIds.has(warehouse.managerId) || !manager || !isEligibleWarehouseManager(manager)) {
      throw new Error('Invalid warehouse manager: ' + warehouse.managerId);
    }
  });
};

const assertToolUnits = (state: MockDatabaseState, refs: ReferenceIndex) => {
  state.units.forEach((unit) => {
    const conditionValid = TOOL_CONDITIONS.includes(unit.condition);
    const lifecycleValid = TOOL_LIFECYCLES.includes(unit.lifecycle);
    if (
      !nonBlank(unit.id) ||
      !nonBlank(unit.definitionId) ||
      !nonBlank(unit.originWarehouseId) ||
      !nonBlank(unit.assignedWarehouseId) ||
      !refs.definitionIds.has(unit.definitionId) ||
      !refs.warehouseIds.has(unit.originWarehouseId) ||
      !refs.warehouseIds.has(unit.assignedWarehouseId) ||
      !conditionValid ||
      !lifecycleValid
    ) {
      throw new Error('Invalid tool unit: ' + unit.id);
    }
  });
};

const assertDefinitionCategories = (state: MockDatabaseState, refs: ReferenceIndex) => {
  state.definitions.forEach((definition) => {
    if (!refs.categoryIds.has(definition.categoryId)) {
      throw new Error('Unknown tool category: ' + definition.categoryId);
    }
    const category = state.categories.find((candidate) => candidate.id === definition.categoryId);
    if (!category || normalizeCategoryName(definition.category) !== category.normalizedName) {
      throw new Error('Tool definition category label does not match authority: ' + definition.id);
    }
  });
};

const assertCustodyRecords = (state: MockDatabaseState, refs: ReferenceIndex) => {
  const custodyCounts = new Map<string, number>();
  state.custody.forEach((record) => {
    custodyCounts.set(record.toolUnitId, (custodyCounts.get(record.toolUnitId) ?? 0) + 1);
    const holder = record.holder;
    const holderExists =
      holder.type === 'worker'
        ? state.users.some((user) => user.id === holder.userId && user.role === 'worker')
        : refs.warehouseIds.has(holder.warehouseId);
    const instantValid = parseCanonicalInstant(record.sinceAt) !== null;
    const unit = state.units.find((candidate) => candidate.id === record.toolUnitId);
    const assignmentConsistent =
      unit !== undefined &&
      (record.holder.type !== 'warehouse' || record.holder.warehouseId === unit.assignedWarehouseId);
    if (!refs.unitIds.has(record.toolUnitId) || !holderExists || !instantValid || !assignmentConsistent) {
      throw new Error('Invalid custody record: ' + record.toolUnitId);
    }
  });
  state.units.forEach((unit) => {
    if ((custodyCounts.get(unit.id) ?? 0) !== 1) {
      throw new Error('Expected one custody record for tool unit: ' + unit.id);
    }
  });
};

const assertAuditEvents = (state: MockDatabaseState, refs: ReferenceIndex) => {
  state.events.forEach((event) => {
    const participantsValid = event.participantIds.every((participantId) => refs.userIds.has(participantId));
    const warehouseValid = event.toolUnitId
      ? event.warehouseId !== undefined && refs.warehouseIds.has(event.warehouseId)
      : !event.warehouseId || refs.warehouseIds.has(event.warehouseId);
    const toolReferenceValid =
      event.toolUnitId === undefined
        ? event.kind === 'admin' && event.scope === 'admin'
        : refs.unitIds.has(event.toolUnitId);
    const valid =
      toolReferenceValid &&
      nonBlank(event.actorId) &&
      refs.userIds.has(event.actorId) &&
      participantsValid &&
      warehouseValid &&
      ACTIVITY_KINDS.includes(event.kind) &&
      ACTIVITY_SCOPES.includes(event.scope) &&
      parseCanonicalInstant(event.occurredAt) !== null;
    assertEvidence(event.evidence, 'audit event');
    if (!valid) throw new Error('Invalid audit event: ' + event.id);
  });
};

const assertPendingHandoffUniqueness = (state: MockDatabaseState) => {
  const pendingUnitIds = new Set<string>();
  state.handoffs.forEach((handoff) => {
    if (handoff.status !== 'pending') return;
    if (pendingUnitIds.has(handoff.toolUnitId)) throw new Error('Invalid handoff: ' + handoff.id);
    pendingUnitIds.add(handoff.toolUnitId);
  });
};

const assertHandoffLifecycle = (state: MockDatabaseState, refs: ReferenceIndex) => {
  state.handoffs.forEach((handoff) => {
    const fromExists =
      handoff.from.type === 'worker'
        ? refs.userIds.has(handoff.from.userId)
        : refs.warehouseIds.has(handoff.from.warehouseId);
    const toExists =
      handoff.to.type === 'worker'
        ? refs.userIds.has(handoff.to.userId)
        : refs.warehouseIds.has(handoff.to.warehouseId);
    const workerHolder = (holder: typeof handoff.from) =>
      holder.type === 'worker' && state.users.some((user) => user.id === holder.userId && user.role === 'worker');
    const currentHolder = state.custody.find((record) => record.toolUnitId === handoff.toolUnitId)?.holder;
    const sourceMatchesCustody = currentHolder !== undefined && sameHolder(handoff.from, currentHolder);
    const statusValid = HANDOFF_STATUSES.includes(handoff.status);
    const kindValid = HANDOFF_KINDS.includes(handoff.kind);
    const resolutionValid =
      handoff.status === 'pending'
        ? handoff.resolvedBy === undefined && handoff.resolvedAt === undefined
        : nonBlank(handoff.resolvedBy ?? '') &&
          refs.userIds.has(handoff.resolvedBy ?? '') &&
          parseCanonicalInstant(handoff.resolvedAt ?? '') !== null;
    // Pending commands must still start from current custody. Resolved handoffs are
    // retained history; later transfers intentionally move the live custody record
    // beyond their historical source/target holders.
    const holderConsistent = handoff.status === 'pending' ? sourceMatchesCustody : true;
    const distinctHolders = !sameHolder(handoff.from, handoff.to);
    const warehouseRequestShape =
      handoff.from.type === 'warehouse' &&
      handoff.to.type === 'worker' &&
      workerHolder(handoff.to) &&
      handoff.requestedBy === handoff.to.userId;
    const transferShape =
      handoff.from.type === 'worker' &&
      workerHolder(handoff.from) &&
      (handoff.to.type === 'warehouse' || workerHolder(handoff.to)) &&
      handoff.requestedBy === handoff.from.userId;
    const kindShape = handoff.kind === 'warehouse-request' ? warehouseRequestShape : transferShape;
    const unitLifecycleValid =
      refs.unitIds.has(handoff.toolUnitId) &&
      (handoff.status !== 'pending' || refs.activeUnitIds.has(handoff.toolUnitId));
    const valid =
      kindValid &&
      statusValid &&
      unitLifecycleValid &&
      fromExists &&
      toExists &&
      nonBlank(handoff.requestedBy) &&
      refs.userIds.has(handoff.requestedBy) &&
      parseCanonicalInstant(handoff.requestedAt) !== null &&
      resolutionValid &&
      holderConsistent &&
      distinctHolders &&
      kindShape;
    assertEvidence(handoff.evidence, 'handoff');
    assertEvidence(handoff.resolutionEvidence, 'handoff resolution');
    if (!valid) throw new Error('Invalid handoff: ' + handoff.id);
  });
};

const assertConditionReports = (state: MockDatabaseState, refs: ReferenceIndex) => {
  state.conditionReports.forEach((report) => {
    const unit = state.units.find((candidate) => candidate.id === report.toolUnitId);
    const valid =
      refs.unitIds.has(report.toolUnitId) &&
      refs.userIds.has(report.reporterId) &&
      CONDITION_REPORTS.includes(report.condition) &&
      parseCanonicalInstant(report.reportedAt) !== null &&
      unit !== undefined;
    assertEvidence(report.evidence, 'condition report');
    if (!valid) throw new Error('Invalid condition report: ' + report.id);
  });
};

export const assertReferences = (state: MockDatabaseState) => {
  assertCollectionIdentity(state);
  const refs = buildReferenceIndex(state);
  assertDemoProfiles(state, refs);
  assertUserAndWarehouseReferences(state, refs);
  assertDefinitionCategories(state, refs);
  assertToolUnits(state, refs);
  assertCustodyRecords(state, refs);
  assertAuditEvents(state, refs);
  assertPendingHandoffUniqueness(state);
  assertHandoffLifecycle(state, refs);
  assertConditionReports(state, refs);
};
