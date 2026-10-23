import type { CompanyProfileView, ToolCategoryView } from '../../domain/read-models/settings';
import type { CategoriesResponseDto, CategoryDto, CompanyDto, ResetReceiptDto } from './http-settings-types';
import {
  arrayValue,
  nonBlankStringValue,
  nonNegativeIntegerValue,
  oneOf,
  positiveIntegerValue,
} from './http-validation';
import { normalizeCategoryName } from '../../domain/organization';

export const mapCompany = (dto: CompanyDto): CompanyProfileView => {
  if (dto.company_id !== 'company') throw new Error('Invalid API response: company id');
  const name = nonBlankStringValue(dto.name, 'company name');
  const address = nonBlankStringValue(dto.address, 'company address');
  return { id: 'company', name, address, revision: positiveIntegerValue(dto.revision, 'company revision') };
};

const mapCategory = (dto: CategoryDto): ToolCategoryView => {
  const name = nonBlankStringValue(dto.name, 'category name');
  if (dto.normalized_name !== normalizeCategoryName(name))
    throw new Error('Invalid API response: category normalization');
  return {
    id: nonBlankStringValue(dto.category_id, 'category id'),
    name,
    normalizedName: dto.normalized_name,
    revision: positiveIntegerValue(dto.revision, 'category revision'),
    usageCount: nonNegativeIntegerValue(dto.usage_count, 'category usage'),
  };
};

export const mapCategories = (dto: CategoriesResponseDto) => {
  const categories = arrayValue<CategoryDto>(dto.categories, 'categories').map(mapCategory);
  if (new Set(categories.map((category) => category.id)).size !== categories.length)
    throw new Error('Invalid API response: category ids');
  if (new Set(categories.map((category) => category.normalizedName)).size !== categories.length)
    throw new Error('Invalid API response: category names');
  return categories;
};

export const mapResetReceipt = (dto: ResetReceiptDto) => ({
  operation: oneOf(dto.operation, ['reset-demo-data'] as const, 'reset operation'),
  seedRevision: nonBlankStringValue(dto.seed_revision, 'seed revision'),
});
