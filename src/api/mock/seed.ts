import type { AuditEvent } from '../../domain/activity';
import type { Member } from '../../domain/people';
import type { CustodyRecord, HandoffRequest } from '../../domain/custody';
import type { ToolUnit } from '../../domain/tool';
import type { Warehouse } from '../../domain/warehouse';
import { seedCategories, seedCompany } from './seed-organization';
import { seedReconciliationIssues } from './seed-reconciliation';
import { demoProfileIds, seedConditionReports } from './seed-activity';
import { assertReferences } from './seed-validation';
import { seedDefinitions } from './seed-definitions';
import type { MockDatabaseState } from './seed-state';

const seedUsers: Member[] = [
  {
    id: 'ray-torres',
    name: 'Ray Torres',
    email: 'ray@nelsonelectric.com',
    role: 'worker',
    lifecycle: 'active',
    title: 'Journeyman electrician',
    homeWarehouseId: 'north-yard',
  },
  {
    id: 'sam-ochoa',
    name: 'Sam Ochoa',
    email: 'sam@nelsonelectric.com',
    role: 'admin',
    lifecycle: 'active',
    title: 'Administrator',
    homeWarehouseId: 'north-yard',
  },
  {
    id: 'avery-cole',
    name: 'Avery Cole',
    email: 'avery@nelsonelectric.com',
    role: 'worker',
    lifecycle: 'active',
    title: 'Apprentice electrician',
    homeWarehouseId: 'south-shop',
  },
  {
    id: 'eli-warren',
    name: 'Eli Warren',
    email: 'eli@nelsonelectric.com',
    role: 'worker',
    lifecycle: 'active',
    title: 'Field electrician',
    homeWarehouseId: 'south-shop',
  },
  {
    id: 'morgan-price',
    name: 'Morgan Price',
    email: 'morgan@nelsonelectric.com',
    role: 'warehouse-manager',
    lifecycle: 'active',
    title: 'Warehouse manager',
    homeWarehouseId: 'south-shop',
  },
  {
    id: 'casey-reed',
    name: 'Casey Reed',
    email: 'casey@nelsonelectric.com',
    role: 'worker',
    lifecycle: 'invited',
    title: 'Field electrician',
    homeWarehouseId: 'north-yard',
  },
  {
    id: 'taylor-nguyen',
    name: 'Taylor Nguyen',
    email: 'taylor@nelsonelectric.com',
    role: 'worker',
    lifecycle: 'suspended',
    title: 'Journeyman electrician',
    homeWarehouseId: 'south-shop',
  },
  {
    id: 'quinn-hart',
    name: 'Quinn Hart',
    email: 'quinn@nelsonelectric.com',
    role: 'worker',
    lifecycle: 'removed',
    title: 'Former electrician',
    homeWarehouseId: 'riverside-depot',
  },
];

const seedWarehouses: Warehouse[] = [
  { id: 'north-yard', name: 'North Yard', address: '1420 Kerr Ave', managerId: 'sam-ochoa' },
  { id: 'south-shop', name: 'South Shop', address: '88 Trade St', managerId: 'sam-ochoa' },
  { id: 'riverside-depot', name: 'Riverside Depot', address: '3 Mill Rd', managerId: 'sam-ochoa' },
];

const seedUnits: ToolUnit[] = [
  {
    id: 'TL-101',
    definitionId: 'def-hammer-drill',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'north-yard',
    assignedWarehouseId: 'north-yard',
  },
  {
    id: 'TL-102',
    definitionId: 'def-multimeter',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'south-shop',
    assignedWarehouseId: 'south-shop',
    serial: '44718829',
  },
  {
    id: 'TL-103',
    definitionId: 'def-hammer-drill',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'north-yard',
    assignedWarehouseId: 'north-yard',
  },
  {
    id: 'TL-104',
    definitionId: 'def-fish-tape',
    condition: 'damaged',
    lifecycle: 'active',
    originWarehouseId: 'riverside-depot',
    assignedWarehouseId: 'riverside-depot',
  },
  {
    id: 'TL-105',
    definitionId: 'def-rotary-hammer',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'north-yard',
    assignedWarehouseId: 'north-yard',
  },
  {
    id: 'TL-106',
    definitionId: 'def-hydraulic-bender',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'riverside-depot',
    assignedWarehouseId: 'riverside-depot',
  },
  {
    id: 'TL-107',
    definitionId: 'def-extension-ladder',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'south-shop',
    assignedWarehouseId: 'south-shop',
  },
  {
    id: 'TL-108',
    definitionId: 'def-bandsaw',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'north-yard',
    assignedWarehouseId: 'north-yard',
  },
  {
    id: 'TL-109',
    definitionId: 'def-knockout-punches',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'north-yard',
    assignedWarehouseId: 'north-yard',
  },
  {
    id: 'TL-110',
    definitionId: 'def-ir-tester',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'south-shop',
    assignedWarehouseId: 'south-shop',
  },
  {
    id: 'TL-111',
    definitionId: 'def-cable-cutter',
    condition: 'lost',
    lifecycle: 'active',
    originWarehouseId: 'riverside-depot',
    assignedWarehouseId: 'riverside-depot',
  },
  {
    id: 'TL-112',
    definitionId: 'def-circuit-tracer',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'south-shop',
    assignedWarehouseId: 'south-shop',
  },
  {
    id: 'TL-113',
    definitionId: 'def-conduit-bender',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'north-yard',
    assignedWarehouseId: 'north-yard',
  },
  {
    id: 'TL-114',
    definitionId: 'def-cord-reel',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'south-shop',
    assignedWarehouseId: 'south-shop',
  },
  {
    id: 'TL-115',
    definitionId: 'def-pump-pliers',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'north-yard',
    assignedWarehouseId: 'north-yard',
  },
  {
    id: 'TL-116',
    definitionId: 'def-step-ladder',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'riverside-depot',
    assignedWarehouseId: 'riverside-depot',
  },
  {
    id: 'TL-117',
    definitionId: 'def-hammer-drill',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'south-shop',
    assignedWarehouseId: 'south-shop',
  },
  {
    id: 'TL-118',
    definitionId: 'def-hammer-drill',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'riverside-depot',
    assignedWarehouseId: 'riverside-depot',
  },
  {
    id: 'TL-119',
    definitionId: 'def-cord-reel',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'south-shop',
    assignedWarehouseId: 'south-shop',
  },
  {
    id: 'TL-120',
    definitionId: 'def-pump-pliers',
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: 'north-yard',
    assignedWarehouseId: 'north-yard',
  },
];

const seedCustody: CustodyRecord[] = [
  { toolUnitId: 'TL-101', holder: { type: 'worker', userId: 'ray-torres' }, sinceAt: '2026-08-12T10:00:00-06:00' },
  { toolUnitId: 'TL-102', holder: { type: 'worker', userId: 'ray-torres' }, sinceAt: '2026-08-16T10:00:00-06:00' },
  { toolUnitId: 'TL-103', holder: { type: 'worker', userId: 'ray-torres' }, sinceAt: '2026-07-28T10:00:00-06:00' },
  { toolUnitId: 'TL-104', holder: { type: 'worker', userId: 'ray-torres' }, sinceAt: '2026-08-13T10:00:00-06:00' },
  {
    toolUnitId: 'TL-105',
    holder: { type: 'warehouse', warehouseId: 'north-yard' },
    sinceAt: '2026-08-04T10:00:00-06:00',
  },
  {
    toolUnitId: 'TL-106',
    holder: { type: 'warehouse', warehouseId: 'riverside-depot' },
    sinceAt: '2026-08-05T10:00:00-06:00',
  },
  {
    toolUnitId: 'TL-107',
    holder: { type: 'warehouse', warehouseId: 'south-shop' },
    sinceAt: '2026-07-27T10:00:00-06:00',
  },
  {
    toolUnitId: 'TL-108',
    holder: { type: 'warehouse', warehouseId: 'north-yard' },
    sinceAt: '2026-08-10T10:00:00-06:00',
  },
  {
    toolUnitId: 'TL-109',
    holder: { type: 'warehouse', warehouseId: 'north-yard' },
    sinceAt: '2026-08-09T10:00:00-06:00',
  },
  {
    toolUnitId: 'TL-110',
    holder: { type: 'warehouse', warehouseId: 'south-shop' },
    sinceAt: '2026-08-08T10:00:00-06:00',
  },
  {
    toolUnitId: 'TL-111',
    holder: { type: 'warehouse', warehouseId: 'riverside-depot' },
    sinceAt: '2026-08-16T10:00:00-06:00',
  },
  { toolUnitId: 'TL-112', holder: { type: 'worker', userId: 'ray-torres' }, sinceAt: '2026-08-14T10:00:00-06:00' },
  {
    toolUnitId: 'TL-113',
    holder: { type: 'warehouse', warehouseId: 'north-yard' },
    sinceAt: '2026-08-06T10:00:00-06:00',
  },
  {
    toolUnitId: 'TL-114',
    holder: { type: 'warehouse', warehouseId: 'south-shop' },
    sinceAt: '2026-08-03T10:00:00-06:00',
  },
  { toolUnitId: 'TL-115', holder: { type: 'worker', userId: 'ray-torres' }, sinceAt: '2026-08-17T10:00:00-06:00' },
  {
    toolUnitId: 'TL-116',
    holder: { type: 'warehouse', warehouseId: 'riverside-depot' },
    sinceAt: '2026-08-02T10:00:00-06:00',
  },
  {
    toolUnitId: 'TL-117',
    holder: { type: 'warehouse', warehouseId: 'south-shop' },
    sinceAt: '2026-08-18T08:30:00-06:00',
  },
  {
    toolUnitId: 'TL-118',
    holder: { type: 'warehouse', warehouseId: 'riverside-depot' },
    sinceAt: '2026-08-18T09:15:00-06:00',
  },
  {
    toolUnitId: 'TL-119',
    holder: { type: 'worker', userId: 'eli-warren' },
    sinceAt: '2026-08-18T08:45:00-06:00',
  },
  {
    toolUnitId: 'TL-120',
    holder: { type: 'worker', userId: 'ray-torres' },
    sinceAt: '2026-08-18T08:20:00-06:00',
  },
];

const seedEvents: AuditEvent[] = [
  {
    id: 'EV-1',
    actorId: 'sam-ochoa',
    action: 'Added a tool to inventory',
    toolUnitId: 'TL-105',
    kind: 'admin',
    scope: 'warehouse',
    participantIds: [],
    warehouseId: 'north-yard',
    occurredAt: '2026-08-17T09:12:00-06:00',
  },
  {
    id: 'EV-2',
    actorId: 'ray-torres',
    action: 'Reported a tool damaged',
    toolUnitId: 'TL-104',
    kind: 'flag',
    scope: 'damage',
    participantIds: ['ray-torres'],
    warehouseId: 'riverside-depot',
    occurredAt: '2026-08-16T09:12:00-06:00',
  },
  {
    id: 'EV-3',
    actorId: 'sam-ochoa',
    action: 'Reviewed Riverside Depot inventory',
    toolUnitId: 'TL-106',
    kind: 'admin',
    scope: 'warehouse',
    participantIds: [],
    warehouseId: 'riverside-depot',
    occurredAt: '2026-08-07T17:12:00-06:00',
  },
  {
    id: 'EV-4',
    actorId: 'ray-torres',
    action: 'Requested a bandsaw handoff',
    toolUnitId: 'TL-108',
    kind: 'request',
    scope: 'worker',
    participantIds: ['ray-torres'],
    warehouseId: 'north-yard',
    occurredAt: '2026-08-17T10:18:00-06:00',
  },
  {
    id: 'EV-5',
    actorId: 'sam-ochoa',
    action: 'Marked a cable cutter lost',
    toolUnitId: 'TL-111',
    kind: 'flag',
    scope: 'damage',
    participantIds: [],
    warehouseId: 'riverside-depot',
    occurredAt: '2026-08-06T15:40:00-06:00',
  },
  {
    id: 'EV-6',
    actorId: 'sam-ochoa',
    action: 'Updated warehouse settings',
    kind: 'admin',
    scope: 'admin',
    participantIds: [],
    warehouseId: 'north-yard',
    occurredAt: '2026-08-05T16:00:00-06:00',
  },
];

const seedHandoffs: HandoffRequest[] = [
  {
    id: 'HO-1',
    kind: 'warehouse-request',
    toolUnitId: 'TL-108',
    from: { type: 'warehouse', warehouseId: 'north-yard' },
    to: { type: 'worker', userId: 'ray-torres' },
    requestedBy: 'ray-torres',
    requestedAt: '2026-08-17T10:18:00-06:00',
    status: 'pending',
  },
  {
    id: 'HO-DEMO-OUT',
    kind: 'transfer',
    toolUnitId: 'TL-120',
    from: { type: 'worker', userId: 'ray-torres' },
    to: { type: 'worker', userId: 'eli-warren' },
    requestedBy: 'ray-torres',
    requestedAt: '2026-08-18T08:20:00-06:00',
    status: 'pending',
    evidence: { note: 'Return after the panel test', mockPhoto: true },
  },
  {
    id: 'HO-DEMO-IN',
    kind: 'transfer',
    toolUnitId: 'TL-119',
    from: { type: 'worker', userId: 'eli-warren' },
    to: { type: 'worker', userId: 'ray-torres' },
    requestedBy: 'eli-warren',
    requestedAt: '2026-08-18T08:45:00-06:00',
    status: 'pending',
    evidence: { note: 'Ready for the west crew' },
  },
];

export const createSeedState = (): MockDatabaseState => {
  const state: MockDatabaseState = {
    demoProfileIds: [...demoProfileIds],
    company: { ...seedCompany },
    categories: seedCategories.map((category) => ({ ...category })),
    users: seedUsers.map((user) => ({ ...user })),
    warehouses: seedWarehouses.map((warehouse) => ({ ...warehouse })),
    definitions: seedDefinitions.map((definition) => ({ ...definition })),
    units: seedUnits.map((unit) => ({ ...unit })),
    custody: seedCustody.map((record) => ({ ...record, holder: { ...record.holder } })),
    handoffs: seedHandoffs.map((handoff) => ({ ...handoff, from: { ...handoff.from }, to: { ...handoff.to } })),
    conditionReports: seedConditionReports.map((report) => ({ ...report })),
    events: seedEvents.map((event) => ({ ...event, participantIds: [...event.participantIds] })),
    reconciliationIssues: seedReconciliationIssues.map((issue) => ({
      ...issue,
      ...(issue.kind === 'duplicate-tool-record'
        ? { candidateToolUnitIds: [...issue.candidateToolUnitIds] as [string, string] }
        : { recordedHolder: { ...issue.recordedHolder }, observedHolder: { ...issue.observedHolder } }),
    })),
  };
  assertReferences(state);
  return state;
};

export { assertReferences } from './seed-validation';
