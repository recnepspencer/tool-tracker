import type { SettingsApi } from '../contracts/settings-api';
import type { MockDatabase } from './mock-database';
import { getCompany, listCategories } from './settings-queries';
import { createCategory, deleteCategory, renameCategory, resetDemoData, updateCompany } from './settings-mutations';

export const createMockSettingsApi = (database: MockDatabase): SettingsApi => ({
  getCompany: async ({ actorId }) => getCompany(database, actorId),
  listCategories: async ({ actorId }) => listCategories(database, actorId),
  updateCompany: async (input) => updateCompany(database, input),
  createCategory: async (input) => createCategory(database, input),
  renameCategory: async (input) => renameCategory(database, input),
  deleteCategory: async (input) => deleteCategory(database, input),
  resetDemoData: async (input) => resetDemoData(database, input),
});
