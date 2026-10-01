import type { Role } from '../domain/auth';

export function homePathForRole(role: Role) {
  if (role === 'warehouse-manager') return '/warehouse/operations/queue';
  return role === 'admin' ? '/admin/operations/queue' : '/worker/tools';
}
