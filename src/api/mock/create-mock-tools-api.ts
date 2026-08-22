import type { ToolsApi } from '../contracts/tools-api';
import { toCatalogItem, toToolDetail, toToolView } from './mock-tool-projections';
import { createTool, createTools } from './tool-mutations';
import { flagTool, restoreTool, updateTool } from './tool-decision-mutations';
import type { MockDatabase } from './mock-database';
import {
  normalizeFlagToolInput,
  normalizeRestoreToolInput,
  normalizeUpdateToolInput,
} from '../tool-command-normalization';

export const createMockToolsApi = (database: MockDatabase): ToolsApi => ({
  listTools: async () => {
    const state = database.read();
    return state.units.filter((unit) => unit.lifecycle === 'active').map((unit) => toToolView(state, unit.id));
  },
  listCatalog: async () => {
    const state = database.read();
    return state.definitions
      .filter((definition) =>
        state.units.some((unit) => unit.lifecycle === 'active' && unit.definitionId === definition.id),
      )
      .map((definition) => toCatalogItem(state, definition.id));
  },
  getToolDetail: async (toolUnitId) => toToolDetail(database.read(), toolUnitId),
  createTool: async (input) => createTool(database, input),
  createTools: async (inputs) => createTools(database, inputs),
  updateTool: async (input) => updateTool(database, normalizeUpdateToolInput(input)),
  flagTool: async (input) => flagTool(database, normalizeFlagToolInput(input)),
  restoreTool: async (input) => restoreTool(database, normalizeRestoreToolInput(input)),
});
