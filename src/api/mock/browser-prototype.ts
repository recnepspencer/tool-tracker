import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';
import { createSeedState, assertReferences } from './seed';
import type { MockDatabaseState } from './seed-state';

// Browser-only presentation state, not a production database or authentication service.
export const PROTOTYPE_STORAGE_KEY = 'nelson-electric-design-v3';

function freshStartingState(): MockDatabaseState {
  const seed = createSeedState();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const offset = Date.parse(`${today}T00:00:00Z`) - Date.parse('2026-08-18T00:00:00Z');
  return JSON.parse(
    JSON.stringify(seed, (_key, value: unknown) =>
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
        ? new Date(Date.parse(value) + offset).toISOString()
        : value,
    ),
  ) as MockDatabaseState;
}

export function createBrowserPrototypeApi() {
  if (import.meta.env.MODE === 'test') return createMockApi();
  const load = () => {
    try {
      const saved = localStorage.getItem(PROTOTYPE_STORAGE_KEY);
      if (!saved) return null;
      const state = JSON.parse(saved) as MockDatabaseState;
      assertReferences(state);
      return state;
    } catch {
      return null;
    }
  };
  const save = (state: unknown) => {
    try {
      localStorage.setItem(PROTOTYPE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing / storage limits leave the current walkthrough usable in memory.
    }
  };
  const database = createMockDatabase({ initialState: freshStartingState(), load, onCommit: save });
  save(database.read());
  return createMockApi(database);
}
