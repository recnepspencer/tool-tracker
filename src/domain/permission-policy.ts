import type { MemberRole } from './people';

export const ADMINISTER_PEOPLE_CAPABILITY = 'administer-people' as const;

export const STRUCTURAL_PERMISSION_RULES = [
  {
    id: 'accepting-party-custody',
    label: 'Custody handoffs',
    description: 'Every handoff requires an accepting party before custody changes.',
    locked: true,
  },
  {
    id: 'immutable-audit-history',
    label: 'Audit history',
    description: 'The audit trail is immutable, including for administrators and owners.',
    locked: true,
  },
  {
    id: 'administer-people-authority',
    label: 'People administration',
    description: 'Only administrators can invite, change, suspend, or remove people.',
    locked: true,
  },
] as const;
export type StructuralPermissionRule = (typeof STRUCTURAL_PERMISSION_RULES)[number];

export const PERMISSION_CAPABILITIES = [
  'browse-tools',
  'request-tools',
  'manage-warehouse',
  'review-handoffs',
  ADMINISTER_PEOPLE_CAPABILITY,
  'preserve-audit-history',
] as const;
export type PermissionCapability = (typeof PERMISSION_CAPABILITIES)[number];

const permissions: Record<MemberRole, ReadonlySet<PermissionCapability>> = {
  worker: new Set(['browse-tools', 'request-tools', 'preserve-audit-history']),
  'warehouse-manager': new Set(['browse-tools', 'manage-warehouse', 'review-handoffs', 'preserve-audit-history']),
  admin: new Set([
    'browse-tools',
    'manage-warehouse',
    'review-handoffs',
    ADMINISTER_PEOPLE_CAPABILITY,
    'preserve-audit-history',
  ]),
};

export const memberHasCapability = (role: MemberRole, capability: PermissionCapability) =>
  permissions[role].has(capability);
