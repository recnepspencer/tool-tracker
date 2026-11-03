import type { Model } from './client';

export type RoleCode = Model<'MemberView'>['roles'][number];
export type AccessState = Model<'MemberView'>['access_state'];

export const ROLES: readonly RoleCode[] = [
  'field_member',
  'equipment_manager',
  'dispatcher',
  'estimator',
  'company_admin',
];

export const ROLE_LABELS: Record<RoleCode, string> = {
  field_member: 'Field member',
  equipment_manager: 'Equipment manager',
  dispatcher: 'Dispatcher',
  estimator: 'Estimator',
  company_admin: 'Company admin',
};

/** Short column codes for the access guide on narrow screens. */
export const ROLE_SHORT: Record<RoleCode, string> = {
  field_member: 'F',
  equipment_manager: 'EM',
  dispatcher: 'D',
  estimator: 'E',
  company_admin: 'A',
};

export const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  field_member: 'Request, hold, and hand off tools; join jobs',
  equipment_manager: 'Run warehouses, the catalog, and tool condition',
  dispatcher: 'Create jobs and assign people to them',
  estimator: 'See the company and its jobs',
  company_admin: 'Everything, plus people and company settings',
};

export const roleList = (roles: readonly RoleCode[]) =>
  ROLES.filter((role) => roles.includes(role))
    .map((role) => ROLE_LABELS[role])
    .join(', ');

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
export const memberRoles = (member: { roles: readonly RoleCode[]; is_owner: boolean }) =>
  (member.is_owner ? ['Owner', roleList(member.roles)] : [roleList(member.roles)]).join(', ');
