import type { CompanyProfileView, ToolCategoryView } from '../../domain/read-models/settings';
import type { AdminMutationReceipt } from '../../domain/admin-mutation';

export interface SettingsActorInput {
  actorId: string;
}

export interface UpdateCompanyInput extends SettingsActorInput {
  expectedRevision: number;
  name: string;
  address: string;
}

export interface CreateCategoryInput extends SettingsActorInput {
  name: string;
}

export interface RenameCategoryInput extends SettingsActorInput {
  categoryId: string;
  expectedRevision: number;
  name: string;
}

export interface DeleteCategoryInput extends SettingsActorInput {
  categoryId: string;
  expectedRevision: number;
}

export interface ResetDemoDataInput extends SettingsActorInput {
  confirmation: string;
}

export interface SettingsApi {
  getCompany(input: SettingsActorInput): Promise<CompanyProfileView>;
  listCategories(input: SettingsActorInput): Promise<ToolCategoryView[]>;
  updateCompany(input: UpdateCompanyInput): Promise<AdminMutationReceipt>;
  createCategory(input: CreateCategoryInput): Promise<AdminMutationReceipt>;
  renameCategory(input: RenameCategoryInput): Promise<AdminMutationReceipt>;
  deleteCategory(input: DeleteCategoryInput): Promise<AdminMutationReceipt>;
  resetDemoData(input: ResetDemoDataInput): Promise<{ operation: 'reset-demo-data'; seedRevision: string }>;
}
