import {
  categoryIdForName,
  normalizeCategoryName,
  type CompanyProfile,
  type ToolCategory,
} from '../../domain/organization';

const categoryNames = ['Power tools', 'Meters & testers', 'Hand tools', 'Benders', 'Ladders', 'Power distribution'];

export const seedCategories: ToolCategory[] = categoryNames.map((name) => ({
  id: categoryIdForName(name),
  name,
  normalizedName: normalizeCategoryName(name),
  revision: 1,
}));

export const seedCompany: CompanyProfile = {
  id: 'company',
  name: 'Nelson Electric',
  address: '1420 Kerr Ave · Denver, CO',
  revision: 1,
};
