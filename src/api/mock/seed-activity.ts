import type { ConditionReport } from '../../domain/condition-report';

export const demoProfileIds = ['ray-torres', 'sam-ochoa'];

export const seedConditionReports: ConditionReport[] = [
  {
    id: 'CR-1',
    toolUnitId: 'TL-104',
    reporterId: 'ray-torres',
    condition: 'damaged',
    reportedAt: '2026-08-16T09:12:00-06:00',
  },
  {
    id: 'CR-2',
    toolUnitId: 'TL-111',
    reporterId: 'sam-ochoa',
    condition: 'lost',
    reportedAt: '2026-08-06T15:40:00-06:00',
  },
];
