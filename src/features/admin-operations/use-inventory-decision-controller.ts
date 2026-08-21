import { useEffect, useState } from 'react';
import type { FlagToolInput, UpdateToolInput } from '../../api/contracts/tools-api';
import type { WarehouseInventoryItemView } from '../../domain/read-models/warehouse-operations';
import { useToolDecisionMutations } from './use-tool-decisions';
import { useWarehouseToolDecisionMutations } from './use-warehouse-tool-decisions';
import { warehouseToolDecisionPolicy } from '../../domain/warehouse-tool-policy';
import { toHolderRef } from './holder-ref';

type EditInput = Omit<
  UpdateToolInput,
  'actorId' | 'toolUnitId' | 'expectedRevision' | 'expectedStatus' | 'expectedHolder'
>;
type FlagInput = Omit<FlagToolInput, 'actorId' | 'toolUnitId' | 'expectedRevision' | 'expectedHolder'>;

export function useInventoryDecisionController({
  items,
  inventoryBlocked,
  scopesBlocked,
}: {
  items?: readonly WarehouseInventoryItemView[];
  inventoryBlocked: boolean;
  scopesBlocked: boolean;
}) {
  const [editItem, setEditItem] = useState<WarehouseInventoryItemView | null>(null);
  const [flagItem, setFlagItem] = useState<WarehouseInventoryItemView | null>(null);
  const [decommissionItem, setDecommissionItem] = useState<WarehouseInventoryItemView | null>(null);
  const toolMutations = useToolDecisionMutations();
  const warehouseMutations = useWarehouseToolDecisionMutations();

  useEffect(() => {
    const currentFor = (item: WarehouseInventoryItemView | null) =>
      item && items?.find((candidate) => candidate.toolUnitId === item.toolUnitId);
    const currentEdit = currentFor(editItem);
    const currentFlag = currentFor(flagItem);
    const currentDecommission = currentFor(decommissionItem);
    if (editItem && (!currentEdit || currentEdit.revision !== editItem.revision)) setEditItem(null);
    if (flagItem && (!currentFlag || currentFlag.revision !== flagItem.revision)) setFlagItem(null);
    if (decommissionItem && (!currentDecommission || currentDecommission.revision !== decommissionItem.revision)) {
      setDecommissionItem(null);
    }
  }, [decommissionItem, editItem, flagItem, items]);

  const busy =
    inventoryBlocked ||
    scopesBlocked ||
    toolMutations.updateTool.isPending ||
    toolMutations.flagTool.isPending ||
    toolMutations.restoreTool.isPending ||
    warehouseMutations.returnTool.isPending ||
    warehouseMutations.decommissionTool.isPending;
  const decisionPending =
    toolMutations.updateTool.isPending ||
    toolMutations.flagTool.isPending ||
    toolMutations.restoreTool.isPending ||
    warehouseMutations.returnTool.isPending ||
    warehouseMutations.decommissionTool.isPending;

  const openEdit = (item: WarehouseInventoryItemView) => {
    if (!busy && warehouseToolDecisionPolicy({ ...item, holder: toHolderRef(item.holder) }).canEdit) setEditItem(item);
  };
  const openFlag = (item: WarehouseInventoryItemView) => {
    if (!busy && warehouseToolDecisionPolicy({ ...item, holder: toHolderRef(item.holder) }).canFlag) setFlagItem(item);
  };
  const openDecommission = (item: WarehouseInventoryItemView) => {
    if (!busy && warehouseToolDecisionPolicy({ ...item, holder: toHolderRef(item.holder) }).canDecommission)
      setDecommissionItem(item);
  };
  const saveEdit = (input: EditInput) => {
    if (!editItem) return;
    void toolMutations.updateTool
      .mutateAsync({
        toolUnitId: editItem.toolUnitId,
        expectedRevision: editItem.revision,
        expectedStatus: editItem.status,
        expectedHolder: toHolderRef(editItem.holder),
        ...input,
      })
      .then(() => setEditItem(null))
      .catch(() => undefined);
  };
  const saveFlag = (input: FlagInput) => {
    if (!flagItem) return;
    void toolMutations.flagTool
      .mutateAsync({
        toolUnitId: flagItem.toolUnitId,
        expectedRevision: flagItem.revision,
        expectedHolder: toHolderRef(flagItem.holder),
        ...input,
      })
      .then(() => setFlagItem(null))
      .catch(() => undefined);
  };
  const restore = (item: WarehouseInventoryItemView) => {
    if (busy || !warehouseToolDecisionPolicy({ ...item, holder: toHolderRef(item.holder) }).canRestore) return;
    void toolMutations.restoreTool
      .mutateAsync({
        toolUnitId: item.toolUnitId,
        expectedRevision: item.revision,
        expectedHolder: toHolderRef(item.holder),
      })
      .catch(() => undefined);
  };
  const returnTool = (item: WarehouseInventoryItemView) => {
    if (busy || !warehouseToolDecisionPolicy({ ...item, holder: toHolderRef(item.holder) }).canForceReturn) return;
    void warehouseMutations.returnTool
      .mutateAsync({ toolUnitId: item.toolUnitId, expectedRevision: item.revision })
      .catch(() => undefined);
  };
  const decommission = (note?: string) => {
    if (!decommissionItem) return;
    void warehouseMutations.decommissionTool
      .mutateAsync({
        toolUnitId: decommissionItem.toolUnitId,
        expectedRevision: decommissionItem.revision,
        ...(note ? { evidence: { note } } : {}),
      })
      .then(() => setDecommissionItem(null))
      .catch(() => undefined);
  };

  const errorFor = (mutation: { isError: boolean; error: unknown }) =>
    mutation.isError && mutation.error instanceof Error ? mutation.error.message : undefined;
  return {
    busy,
    decisionPending,
    editItem,
    flagItem,
    decommissionItem,
    openEdit,
    openFlag,
    openDecommission,
    closeEdit: () => setEditItem(null),
    closeFlag: () => setFlagItem(null),
    closeDecommission: () => setDecommissionItem(null),
    saveEdit,
    saveFlag,
    restore,
    returnTool,
    decommission,
    editError: errorFor(toolMutations.updateTool),
    flagError: errorFor(toolMutations.flagTool),
    decommissionError: errorFor(warehouseMutations.decommissionTool),
    restoreError: errorFor(toolMutations.restoreTool),
    returnError: errorFor(warehouseMutations.returnTool),
    resetEditError: () => toolMutations.updateTool.reset(),
    resetFlagError: () => toolMutations.flagTool.reset(),
    resetDecommissionError: () => warehouseMutations.decommissionTool.reset(),
    resetRestoreError: () => toolMutations.restoreTool.reset(),
    resetReturnError: () => warehouseMutations.returnTool.reset(),
  };
}
