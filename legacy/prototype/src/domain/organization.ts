export interface CompanyProfile {
  id: 'company';
  name: string;
  address: string;
  revision: number;
}

export interface ToolCategory {
  id: string;
  name: string;
  normalizedName: string;
  revision: number;
}

export const normalizeOrganizationName = (value: string) => value.trim().replace(/\s+/g, ' ');

export const normalizeCategoryName = (value: string) => normalizeOrganizationName(value).toLocaleLowerCase();

export const categoryIdForName = (name: string) =>
  'category-' +
  normalizeCategoryName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
