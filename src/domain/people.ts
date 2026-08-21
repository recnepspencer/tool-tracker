export const MEMBER_ROLES = ['worker', 'warehouse-manager', 'admin'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const DEMO_ROLES = ['worker', 'admin'] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const MEMBER_LIFECYCLES = ['active', 'invited', 'suspended', 'removed'] as const;
export type MemberLifecycle = (typeof MEMBER_LIFECYCLES)[number];

export const PERSON_ACCESS_STATES = ['active', 'suspended'] as const;
export type PersonAccessState = (typeof PERSON_ACCESS_STATES)[number];

export const isActiveMember = (member: { lifecycle: MemberLifecycle }) => member.lifecycle === 'active';

export const isRemovedMember = (member: { lifecycle: MemberLifecycle }) => member.lifecycle === 'removed';

export const canChangePersonAccess = (lifecycle: MemberLifecycle, access: PersonAccessState) =>
  !isRemovedMember({ lifecycle }) && lifecycle !== access;

export const canEditPersonRole = (lifecycle: MemberLifecycle) => !isRemovedMember({ lifecycle });

export const canAuthenticate = (member: { lifecycle: MemberLifecycle; role: MemberRole }) =>
  member.lifecycle === 'active' && DEMO_ROLES.includes(member.role as DemoRole);

export const isAdminMember = (member: { lifecycle: MemberLifecycle; role: MemberRole }) =>
  member.lifecycle === 'active' && member.role === 'admin';

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  worker: 'Worker',
  'warehouse-manager': 'Warehouse manager',
  admin: 'Administrator',
};

export const MEMBER_LIFECYCLE_LABELS: Record<MemberLifecycle, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
  removed: 'Removed',
};

/** Canonical people record shared by authentication, custody, and administration. */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  lifecycle: MemberLifecycle;
  title: string;
  homeWarehouseId: string;
}
