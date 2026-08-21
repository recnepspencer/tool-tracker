import type { Role } from '../domain/auth';

export function homePathForRole(role: Role) {
  return role === 'admin' ? '/admin/dashboard' : '/worker/tools';
}
