import type { AuditEvent } from '../../domain/activity';
import type { ConditionReport } from '../../domain/condition-report';
import type { Member } from '../../domain/people';
import type { CustodyRecord, HandoffRequest } from '../../domain/custody';
import type { ToolDefinition, ToolUnit } from '../../domain/tool';
import type { Warehouse } from '../../domain/warehouse';
import type { CompanyProfile, ToolCategory } from '../../domain/organization';
import type { ReconciliationIssue } from '../../domain/reconciliation';

/** Mutable runtime authority owned by the mock database transaction boundary. */
export interface MockDatabaseState {
  demoProfileIds: string[];
  company: CompanyProfile;
  categories: ToolCategory[];
  users: Member[];
  warehouses: Warehouse[];
  definitions: ToolDefinition[];
  units: ToolUnit[];
  custody: CustodyRecord[];
  handoffs: HandoffRequest[];
  conditionReports: ConditionReport[];
  events: AuditEvent[];
  reconciliationIssues: ReconciliationIssue[];
}

/** Deeply immutable read-side view; projections cannot mutate nested seed records. */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type SeedSnapshot = DeepReadonly<MockDatabaseState>;
