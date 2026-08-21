import type { ReconciliationIssue } from '../../domain/reconciliation';

export const seedReconciliationIssues: ReconciliationIssue[] = [
  {
    id: 'REC-1',
    kind: 'duplicate-tool-record',
    candidateToolUnitIds: ['TL-101', 'TL-103'],
    reason: 'Two active hammer drill records were reported in the same field kit review.',
    detectedAt: '2026-08-17T11:00:00-06:00',
    revision: 1,
    status: 'open',
  },
  {
    id: 'REC-2',
    kind: 'custody-mismatch',
    toolUnitId: 'TL-105',
    recordedHolder: { type: 'warehouse', warehouseId: 'north-yard' },
    observedHolder: { type: 'warehouse', warehouseId: 'south-shop' },
    reason: 'Cycle count observed the unit at South Shop while the ledger says North Yard.',
    detectedAt: '2026-08-17T12:30:00-06:00',
    revision: 1,
    status: 'open',
  },
];
