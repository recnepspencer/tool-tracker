import type { MockDatabase } from './mock-database';
import { requireAdminActor } from './admin-authorization';
import { isActiveMember } from '../../domain/people';
import { WorkflowError } from '../../domain/workflow-error';
import type { CompanyProfileView, ToolCategoryView } from '../../domain/read-models/settings';

export const getCompany = (database: MockDatabase, actorId: string): CompanyProfileView => {
  const state = database.read();
  requireAdminActor(state, actorId);
  return { ...state.company };
};

export const listCategories = (database: MockDatabase, actorId: string): ToolCategoryView[] => {
  const state = database.read();
  const actor = state.users.find((candidate) => candidate.id === actorId);
  if (!actor || !isActiveMember(actor)) throw new WorkflowError('forbidden', 'An active member is required');
  return state.categories
    .map((category) => ({
      ...category,
      usageCount: state.definitions.filter((definition) => definition.categoryId === category.id).length,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};
