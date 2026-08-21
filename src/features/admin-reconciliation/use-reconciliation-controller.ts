import { useState } from 'react';
import type { ReconciliationIssueView } from '../../domain/reconciliation';
import { useReconciliation } from './use-reconciliation';
import { dismissInput, mergeInput, resolveMismatchInput } from './reconciliation-command-inputs';

export function useReconciliationController() {
  const reconciliation = useReconciliation();
  const [selected, setSelected] = useState<ReconciliationIssueView | null>(null);
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<'keep-recorded' | 'accept-observed'>('accept-observed');
  const [commandError, setCommandError] = useState<string | null>(null);
  const busy =
    reconciliation.isFetching ||
    reconciliation.isPaused ||
    reconciliation.isError ||
    reconciliation.dismissDuplicate.isPending ||
    reconciliation.mergeDuplicate.isPending ||
    reconciliation.resolveCustodyMismatch.isPending;

  const close = () => {
    if (busy) return;
    setSelected(null);
    setNote('');
    setCommandError(null);
  };
  const run = (command: Promise<unknown>) =>
    void command.then(close).catch((error: unknown) => {
      setCommandError(error instanceof Error ? error.message : 'The decision could not be saved.');
    });
  const dismiss = (issue: Extract<ReconciliationIssueView, { kind: 'duplicate-tool-record' }>) =>
    run(reconciliation.dismissDuplicate.mutateAsync(dismissInput(issue, note)));
  const merge = (issue: Extract<ReconciliationIssueView, { kind: 'duplicate-tool-record' }>) =>
    run(reconciliation.mergeDuplicate.mutateAsync(mergeInput(issue, note)));
  const resolveMismatch = (issue: Extract<ReconciliationIssueView, { kind: 'custody-mismatch' }>) =>
    run(reconciliation.resolveCustodyMismatch.mutateAsync(resolveMismatchInput(issue, decision, note)));
  const review = (issue: ReconciliationIssueView) => {
    setCommandError(null);
    setSelected(issue);
  };
  return {
    ...reconciliation,
    selected,
    note,
    decision,
    commandError,
    busy,
    setNote,
    setDecision,
    review,
    close,
    dismiss,
    merge,
    resolveMismatch,
  };
}

export type ReconciliationController = ReturnType<typeof useReconciliationController>;
