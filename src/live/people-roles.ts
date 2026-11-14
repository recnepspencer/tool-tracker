import type { Model } from './client';

export type RoleCode = Model<'MemberView'>['role'];
export type AccessState = Model<'MemberView'>['access_state'];

/** Each role can do everything the one before it can. */
export const ROLES: readonly RoleCode[] = ['foreman', 'manager', 'admin'];

export const ROLE_LABELS: Record<RoleCode, string> = {
  foreman: 'Foreman',
  manager: 'Manager',
  admin: 'Admin',
};

/** Short column codes for the access guide on narrow screens. */
export const ROLE_SHORT: Record<RoleCode, string> = {
  foreman: 'F',
  manager: 'M',
  admin: 'A',
};

export const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  foreman: 'Hold, request and hand off tools; join jobs',
  manager: 'Everything a foreman does, plus tools, the catalog, warehouses and jobs',
  admin: 'Everything a manager does, plus people and company settings',
};

export type MemberLifecycle = 'active' | 'suspended' | 'disabled' | 'former';

export const memberLifecycle = (member: Pick<Model<'MemberView'>, 'access_state' | 'ended_at'>): MemberLifecycle =>
  member.ended_at ? 'former' : member.access_state;

export const LIFECYCLE_LABELS: Record<MemberLifecycle, string> = {
  active: 'Active',
  suspended: 'Suspended',
  disabled: 'Disabled',
  former: 'Former employee',
};

/** The demo's `lifecycle-pill--*` tone for each live access state. */
export const LIFECYCLE_PILL: Record<MemberLifecycle, string> = {
  active: 'active',
  suspended: 'suspended',
  disabled: 'removed',
  former: 'removed',
};

/** Roles as shown on a member, led by ownership, which sits above every role. */
export const memberRoles = (member: { role: RoleCode; is_owner: boolean }) =>
  member.is_owner ? `Owner, ${ROLE_LABELS[member.role]}` : ROLE_LABELS[member.role];
