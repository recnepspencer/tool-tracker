import { normalizeCustodyEvidence } from '../domain/evidence';

export const optionalText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const requiredText = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(label + ' is required');
  return trimmed;
};

export const normalizeExpectedRevision = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Expected revision must be a positive integer');
  return value;
};

export const normalizeEvidence = <T extends { evidence?: Parameters<typeof normalizeCustodyEvidence>[0] }>(
  input: T,
) => {
  const evidence = input.evidence ? normalizeCustodyEvidence(input.evidence) : undefined;
  return { ...input, ...(evidence ? { evidence } : {}) };
};
