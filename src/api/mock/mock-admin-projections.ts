import type {
  AdminHeldToolView,
  AdminPersonDetail,
  AdminPersonView,
  AdminSummary,
  AdminWarehouseView,
  PermissionMatrixRow,
  WarehouseCoverageView,
} from '../../domain/read-models/admin';
import { compareActivityTimestamps, formatActivityTimestamp, parseCanonicalInstant } from '../../domain/activity';
import { MEMBER_ROLE_LABELS, MEMBER_ROLES, canAuthenticate } from '../../domain/people';
import {
  PERMISSION_CAPABILITIES,
  STRUCTURAL_PERMISSION_RULES,
  memberHasCapability,
} from '../../domain/permission-policy';
import { toEventView } from './mock-event-projections';
import { toToolView } from './mock-tool-projections';
import { classifyWarehouseQueueItem } from '../../domain/warehouse-queue';
import { currentWarehouseForUnit } from '../../domain/warehouse-responsibility';
import type { MockState } from './mock-state';

const activeUnits = (state: MockState) => state.units.filter((unit) => unit.lifecycle === 'active');
const LONG_HELD_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

const warehouseCoverage = (state: MockState, warehouse: MockState['warehouses'][number]): WarehouseCoverageView => {
  const activeUnitIds = new Set(activeUnits(state).map((unit) => unit.id));
  const stock = state.custody.filter(
    (record) =>
      activeUnitIds.has(record.toolUnitId) &&
      record.holder.type === 'warehouse' &&
      record.holder.warehouseId === warehouse.id,
  ).length;
  const out = activeUnits(state).filter((unit) => {
    const holder = state.custody.find((record) => record.toolUnitId === unit.id)?.holder;
    return currentWarehouseForUnit(unit, holder) === warehouse.id && holder?.type === 'worker';
  }).length;
  return {
    id: warehouse.id,
    name: warehouse.name,
    address: warehouse.address,
    managerId: warehouse.managerId,
    manager: state.users.find((user) => user.id === warehouse.managerId)?.name ?? 'Unassigned',
    tools: stock,
    out,
  };
};

const personView = (state: MockState, userId: string): AdminPersonView => {
  const user = state.users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error('Person not found: ' + userId);
  const heldToolCount = state.custody.filter(
    (record) => record.holder.type === 'worker' && record.holder.userId === user.id,
  ).length;
  const pendingHandoffCount = state.handoffs.filter(
    (handoff) =>
      handoff.status === 'pending' &&
      [
        handoff.requestedBy,
        handoff.from.type === 'worker' ? handoff.from.userId : '',
        handoff.to.type === 'worker' ? handoff.to.userId : '',
      ].includes(user.id),
  ).length;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    title: user.title,
    role: user.role,
    lifecycle: user.lifecycle,
    homeWarehouseId: user.homeWarehouseId,
    homeWarehouse:
      state.warehouses.find((warehouse) => warehouse.id === user.homeWarehouseId)?.name ?? 'Unknown warehouse',
    canAuthenticate: canAuthenticate(user),
    heldToolCount,
    pendingHandoffCount,
  };
};

const heldToolView = (state: MockState, userId: string, record: MockState['custody'][number]): AdminHeldToolView => {
  const tool = toToolView(state, record.toolUnitId);
  const unit = state.units.find((candidate) => candidate.id === record.toolUnitId);
  const warehouseId = unit ? currentWarehouseForUnit(unit, record.holder) : undefined;
  const warehouse = state.warehouses.find((candidate) => candidate.id === warehouseId);
  if (!warehouse) throw new Error('Held tool warehouse not found: ' + record.toolUnitId);
  if (record.holder.type !== 'worker' || record.holder.userId !== userId) throw new Error('Held tool mismatch');
  const status: AdminHeldToolView['status'] = tool.status === 'in-stock' ? 'checked-out' : tool.status;
  return {
    toolUnitId: record.toolUnitId,
    toolName: tool.name,
    holderSince: formatActivityTimestamp(record.sinceAt),
    holderSinceAt: record.sinceAt,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    status,
  };
};

export const projectPerson = (state: MockState, userId: string): AdminPersonDetail => {
  const base = personView(state, userId);
  const heldTools = state.custody
    .filter((record) => record.holder.type === 'worker' && record.holder.userId === userId)
    .map((record) => heldToolView(state, userId, record))
    .sort((left, right) => left.toolName.localeCompare(right.toolName));
  const recentEvents = state.events
    .filter((event) => event.actorId === userId || event.participantIds.includes(userId))
    .map((event) => toEventView(state, event.id))
    .sort(
      (left, right) => compareActivityTimestamps(left.timestamp, right.timestamp) || left.id.localeCompare(right.id),
    );
  return { ...base, heldTools, recentEvents };
};

export const projectPeople = (state: MockState): AdminPersonView[] =>
  state.users.map((user) => personView(state, user.id)).sort((left, right) => left.name.localeCompare(right.name));

export const projectPermissions = (): PermissionMatrixRow[] =>
  MEMBER_ROLES.map((role) => ({
    role,
    label: MEMBER_ROLE_LABELS[role],
    capabilities: PERMISSION_CAPABILITIES.filter((capability) => memberHasCapability(role, capability)),
    structuralRules: STRUCTURAL_PERMISSION_RULES.map((rule) => ({ ...rule })),
  }));

export const projectWarehouses = (state: MockState): AdminWarehouseView[] =>
  state.warehouses.map((warehouse) => {
    const coverage = warehouseCoverage(state, warehouse);
    const manager = state.users.find((user) => user.id === warehouse.managerId);
    if (!manager) throw new Error('Warehouse manager missing: ' + warehouse.id);
    return {
      ...coverage,
      managerRole: manager.role,
      managerLifecycle: manager.lifecycle,
    };
  });

const longHeldTools = (state: MockState, now: string): AdminHeldToolView[] => {
  const nowEpoch = parseCanonicalInstant(now);
  if (nowEpoch === null) throw new Error('Invalid admin clock instant');
  const threshold = nowEpoch - LONG_HELD_THRESHOLD_MS;
  const activeUnitIds = new Set(activeUnits(state).map((unit) => unit.id));
  return state.custody
    .filter((record) => {
      const since = parseCanonicalInstant(record.sinceAt);
      return (
        activeUnitIds.has(record.toolUnitId) && record.holder.type === 'worker' && since !== null && since <= threshold
      );
    })
    .map((record) => heldToolView(state, record.holder.type === 'worker' ? record.holder.userId : '', record))
    .sort((left, right) => {
      const leftEpoch = parseCanonicalInstant(left.holderSinceAt)!;
      const rightEpoch = parseCanonicalInstant(right.holderSinceAt)!;
      return leftEpoch - rightEpoch || left.toolUnitId.localeCompare(right.toolUnitId);
    });
};

export const projectSummary = (state: MockState, now: string): AdminSummary => {
  const tools = state.units.filter((unit) => unit.lifecycle === 'active').map((unit) => toToolView(state, unit.id));
  return {
    totalTools: tools.length,
    checkedOut: tools.filter((tool) => tool.holder.type === 'worker').length,
    inStock: tools.filter((tool) => tool.holder.type === 'warehouse' && tool.status === 'in-stock').length,
    flagged: tools.filter((tool) => tool.status === 'damaged' || tool.status === 'lost').length,
    warehouses: state.warehouses.map((warehouse) => warehouseCoverage(state, warehouse)),
    recentEvents: state.events
      .map((event) => toEventView(state, event.id))
      .sort(
        (left, right) => compareActivityTimestamps(left.timestamp, right.timestamp) || left.id.localeCompare(right.id),
      ),
    pendingApprovals: state.handoffs.filter(
      (handoff) => handoff.status === 'pending' && classifyWarehouseQueueItem(handoff) !== null,
    ).length,
    longHeldTools: longHeldTools(state, now),
  };
};
