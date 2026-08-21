import type { Role } from '../auth';

export interface DemoProfileView {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  homeWarehouseId: string;
  homeWarehouse: string;
}
