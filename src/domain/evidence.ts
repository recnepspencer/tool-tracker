export interface CustodyEvidence {
  note?: string;
  mockPhoto?: boolean;
}

export const normalizeCustodyEvidence = (evidence?: CustodyEvidence): CustodyEvidence | undefined => {
  if (!evidence) return undefined;
  const note = typeof evidence.note === 'string' ? evidence.note.trim() : undefined;
  const mockPhoto = evidence.mockPhoto === true;
  if (!note && !mockPhoto) return undefined;
  return {
    ...(note ? { note } : {}),
    ...(mockPhoto ? { mockPhoto: true } : {}),
  };
};
