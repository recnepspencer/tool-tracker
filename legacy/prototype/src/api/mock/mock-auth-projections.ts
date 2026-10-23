import { ROLES, type AuthSession, type Role } from '../../domain/auth';
import type { Member } from '../../domain/people';
import type { DemoProfileView } from '../../domain/read-models/auth';

const demoRole = (role: Member['role']): Role => {
  if (!ROLES.includes(role as Role)) throw new Error('That profile cannot authenticate.');
  return role as Role;
};

export const toSession = (user: Member, warehouseName: string): AuthSession => ({
  profileId: user.id,
  name: user.name,
  role: demoRole(user.role),
  email: user.email,
  title: user.title,
  homeWarehouseId: user.homeWarehouseId,
  homeWarehouse: warehouseName,
});

export const toProfileView = (user: Member, warehouseName: string): DemoProfileView => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: demoRole(user.role),
  title: user.title,
  homeWarehouseId: user.homeWarehouseId,
  homeWarehouse: warehouseName,
});
