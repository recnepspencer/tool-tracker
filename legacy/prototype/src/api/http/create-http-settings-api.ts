import type { SettingsApi } from '../contracts/settings-api';
import type { HttpApiOptions } from './http-options';
import { pathWithBase } from './http-transport';
import { mapCategories, mapCompany, mapResetReceipt } from './http-settings-mappers';
import type { CategoriesResponseDto, CompanyDto, ResetReceiptDto } from './http-settings-types';
import type { MutationReceiptDto } from './http-admin-types';
import { mapMutationReceipt } from './http-admin-command-mappers';
import { ADMIN_MUTATION_OPERATIONS } from '../../domain/admin-mutation';
import { settingMutationBody } from './http-settings-command-mappers';

const query = (actorId: string) => '?actor_id=' + encodeURIComponent(actorId);

export const createHttpSettingsApi = ({ transport, basePath = '/api' }: HttpApiOptions): SettingsApi => ({
  getCompany: async ({ actorId }) =>
    mapCompany(await transport.get<CompanyDto>(pathWithBase(basePath, '/settings/company' + query(actorId)))),
  listCategories: async ({ actorId }) =>
    mapCategories(
      await transport.get<CategoriesResponseDto>(pathWithBase(basePath, '/settings/categories' + query(actorId))),
    ),
  updateCompany: async (input) =>
    mapMutationReceipt(
      await transport.post<MutationReceiptDto>(
        pathWithBase(basePath, '/admin/settings/company'),
        settingMutationBody(input.actorId, {
          expected_revision: input.expectedRevision,
          name: input.name,
          address: input.address,
        }),
      ),
      { operation: ADMIN_MUTATION_OPERATIONS.updateCompany },
    ),
  createCategory: async (input) =>
    mapMutationReceipt(
      await transport.post<MutationReceiptDto>(
        pathWithBase(basePath, '/admin/settings/categories'),
        settingMutationBody(input.actorId, { name: input.name }),
      ),
      { operation: ADMIN_MUTATION_OPERATIONS.createCategory },
    ),
  renameCategory: async (input) =>
    mapMutationReceipt(
      await transport.post<MutationReceiptDto>(
        pathWithBase(basePath, '/admin/settings/categories/' + encodeURIComponent(input.categoryId) + '/rename'),
        settingMutationBody(input.actorId, { expected_revision: input.expectedRevision, name: input.name }),
      ),
      { operation: ADMIN_MUTATION_OPERATIONS.renameCategory },
    ),
  deleteCategory: async (input) =>
    mapMutationReceipt(
      await transport.post<MutationReceiptDto>(
        pathWithBase(basePath, '/admin/settings/categories/' + encodeURIComponent(input.categoryId) + '/delete'),
        settingMutationBody(input.actorId, { expected_revision: input.expectedRevision }),
      ),
      { operation: ADMIN_MUTATION_OPERATIONS.deleteCategory },
    ),
  resetDemoData: async (input) =>
    mapResetReceipt(
      await transport.post<ResetReceiptDto>(
        pathWithBase(basePath, '/admin/settings/reset-demo-data'),
        settingMutationBody(input.actorId, { confirmation: input.confirmation }),
      ),
    ),
});
