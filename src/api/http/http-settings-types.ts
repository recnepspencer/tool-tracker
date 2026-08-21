export interface CompanyDto {
  company_id: 'company';
  name: string;
  address: string;
  revision: number;
}

export interface CategoryDto {
  category_id: string;
  name: string;
  normalized_name: string;
  revision: number;
  usage_count: number;
}

export interface CategoriesResponseDto {
  categories: CategoryDto[];
}

export interface ResetReceiptDto {
  operation: 'reset-demo-data';
  seed_revision: string;
}
