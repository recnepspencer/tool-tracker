import type { Model } from './client';

export const requestStatusLabel: Record<Model<'ParticipationView'>['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
