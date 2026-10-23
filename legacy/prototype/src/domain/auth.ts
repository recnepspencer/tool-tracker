import { DEMO_ROLES, type DemoRole, type Member } from './people';

export const ROLES = DEMO_ROLES;
export type Role = DemoRole;

/** Compatibility alias; the canonical member record lives in people.ts. */
export type User = Member;

export interface AuthSession {
  profileId: string;
  name: string;
  role: Role;
  email: string;
  /** Metadata returned with the authenticated identity, not re-read from the demo-profile directory. */
  title: string;
  homeWarehouseId: string;
  homeWarehouse: string;
}
