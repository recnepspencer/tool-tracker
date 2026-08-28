import type { MockDatabaseState, SeedSnapshot } from './seed-state';
import { assertReferences, createSeedState } from './seed';

export interface MockDatabase {
  read(): SeedSnapshot;
  update(updater: (current: MockDatabaseState) => MockDatabaseState): void;
  reset(): void;
  clock(): string;
  nextId(prefix: string): string;
}

export interface MockDatabaseOptions {
  clock?: () => string;
  idGenerator?: (prefix: string) => string;
}

const cloneState = (state: SeedSnapshot): MockDatabaseState => ({
  demoProfileIds: [...state.demoProfileIds],
  company: { ...state.company },
  categories: state.categories.map((category) => ({ ...category })),
  users: state.users.map((user) => ({ ...user })),
  warehouses: state.warehouses.map((warehouse) => ({ ...warehouse })),
  definitions: state.definitions.map((definition) => ({ ...definition })),
  units: state.units.map((unit) => ({ ...unit })),
  custody: state.custody.map((record) => ({ ...record, holder: { ...record.holder } })),
  handoffs: state.handoffs.map((handoff) => ({
    ...handoff,
    from: { ...handoff.from },
    to: { ...handoff.to },
    ...(handoff.evidence ? { evidence: { ...handoff.evidence } } : {}),
    ...(handoff.resolutionEvidence ? { resolutionEvidence: { ...handoff.resolutionEvidence } } : {}),
  })),
  conditionReports: state.conditionReports.map((report) => ({
    ...report,
    ...(report.evidence ? { evidence: { ...report.evidence } } : {}),
  })),
  events: state.events.map((event) => ({
    ...event,
    participantIds: [...event.participantIds],
    ...(event.evidence ? { evidence: { ...event.evidence } } : {}),
  })),
});

export const createMockDatabase = (options: MockDatabaseOptions = {}): MockDatabase => {
  let state: MockDatabaseState = createSeedState();
  let sequence = 0;
  const clock = options.clock ?? (() => new Date().toISOString());
  const defaultIdGenerator = (prefix: string) => {
    let candidate: string;
    const existingIds = new Set([
      ...state.users.map((user) => user.id),
      ...state.warehouses.map((warehouse) => warehouse.id),
      ...state.definitions.map((definition) => definition.id),
      ...state.units.map((unit) => unit.id),
      ...state.handoffs.map((handoff) => handoff.id),
      ...state.conditionReports.map((report) => report.id),
      ...state.events.map((event) => event.id),
      ...state.categories.map((category) => category.id),
    ]);
    do {
      sequence += 1;
      candidate = prefix + '-' + sequence;
    } while (existingIds.has(candidate));
    return candidate;
  };
  const idGenerator = options.idGenerator ?? defaultIdGenerator;

  return {
    read: () => cloneState(state),
    update: (updater) => {
      const next = updater(cloneState(state));
      assertReferences(next);
      state = cloneState(next);
    },
    reset: () => {
      state = createSeedState();
      sequence = 0;
    },
    clock,
    nextId: idGenerator,
  };
};
