import type { MemberLifecycle, MemberRole } from './people';

export interface Warehouse {
  id: string;
  name: string;
  address: string;
  managerId: string;
}

export const isEligibleWarehouseManager = (member: { lifecycle: MemberLifecycle; role: MemberRole }) =>
  member.lifecycle === 'active' && (member.role === 'warehouse-manager' || member.role === 'admin');
