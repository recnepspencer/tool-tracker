import type { ReconciliationController } from './use-reconciliation-controller';
import { CustodyMismatchDialog } from './CustodyMismatchDialog';
import { MergeRecordsDialog } from './MergeRecordsDialog';

export function ReconciliationReviewDialog({ controller }: { controller: ReconciliationController }) {
  const { selected } = controller;
  if (!selected) return null;
  return selected.kind === 'duplicate-tool-record' ? (
    <MergeRecordsDialog issue={selected} controller={controller} />
  ) : (
    <CustodyMismatchDialog issue={selected} controller={controller} />
  );
}
