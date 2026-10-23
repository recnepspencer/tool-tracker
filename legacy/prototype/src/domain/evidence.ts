export interface CustodyPhotoEvidence {
  fileName: string;
  src: string;
}

export interface CustodyEvidence {
  note?: string;
  photo?: CustodyPhotoEvidence;
}

export const normalizeCustodyEvidence = (evidence?: CustodyEvidence): CustodyEvidence | undefined => {
  if (!evidence) return undefined;
  const note = typeof evidence.note === 'string' ? evidence.note.trim() : undefined;
  const fileName = evidence.photo?.fileName.trim();
  const src = evidence.photo?.src.trim();
  const photo = fileName && src ? { fileName, src } : undefined;
  if (!note && !photo) return undefined;
  return {
    ...(note ? { note } : {}),
    ...(photo ? { photo } : {}),
  };
};
