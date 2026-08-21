import type { CompanyProfile, ToolCategory } from '../organization';

export type CompanyProfileView = CompanyProfile;

export interface ToolCategoryView extends ToolCategory {
  usageCount: number;
}
