import type { ToolCatalogItem, ToolDetailView, ToolView } from '../../domain/read-models/tools';
import type { HolderRef } from '../../domain/custody';
import type { CustodyEvidence } from '../../domain/evidence';
import type { ConditionReportKind } from '../../domain/condition-report';
import type { ToolStatus } from '../../domain/tool';

export interface CreateToolInput {
  actorId: string;
  definition: {
    name: string;
    brand: string;
    model: string;
    categoryId: string;
    /** Optional display snapshot accepted only at presentation boundaries. */
    category?: string;
    imageKey: string;
  };
  warehouseId: string;
  photoCaptured: boolean;
  serial?: string;
  price?: string;
  evidence?: CustodyEvidence;
}

export interface UpdateToolInput {
  actorId: string;
  toolUnitId: string;
  expectedRevision: number;
  /** Optimistic shape preconditions prove an edit cannot rewrite custody/status. */
  expectedStatus: ToolStatus;
  expectedHolder: HolderRef;
  definition: {
    name: string;
    brand: string;
    model: string;
    categoryId: string;
    /** Optional display snapshot accepted only at presentation boundaries. */
    category?: string;
    imageKey: string;
  };
  serial?: string;
  price?: string;
  evidence?: CustodyEvidence;
}

export interface FlagToolInput {
  actorId: string;
  toolUnitId: string;
  expectedRevision: number;
  /** Optimistic custody precondition proves flagging cannot rewrite the holder. */
  expectedHolder: HolderRef;
  condition: ConditionReportKind;
  evidence?: CustodyEvidence;
}

export interface RestoreToolInput {
  actorId: string;
  toolUnitId: string;
  expectedRevision: number;
  /** Optimistic custody precondition proves restoring cannot move the unit. */
  expectedHolder: HolderRef;
  evidence?: CustodyEvidence;
}

export interface ToolsApi {
  listTools(): Promise<ToolView[]>;
  listCatalog(): Promise<ToolCatalogItem[]>;
  getToolDetail(toolUnitId: string): Promise<ToolDetailView>;
  createTool(input: CreateToolInput): Promise<ToolView>;
  updateTool(input: UpdateToolInput): Promise<ToolView>;
  flagTool(input: FlagToolInput): Promise<ToolView>;
  restoreTool(input: RestoreToolInput): Promise<ToolView>;
}
