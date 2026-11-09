import type { Model } from './client';

export const responsibilityLabel: Record<Model<'AssignmentView'>['responsibility'], string> = {
  crew: 'Crew',
  foreman: 'Foreman',
  supervisor: 'Supervisor',
};

export const requestStatusLabel: Record<Model<'ParticipationView'>['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const options = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as Array<[K, string]>).map(([value, label]) => ({ value, label }));
