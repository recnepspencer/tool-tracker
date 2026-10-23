import type { CustodyEvidence } from '../../domain/evidence';
import { normalizeCustodyEvidence } from '../../domain/evidence';
import { nonBlankStringValue } from './http-validation';

export interface EvidenceDto {
  note?: string;
  photo?: { file_name: string; src: string };
}

export const toEvidenceDto = (evidence?: CustodyEvidence): EvidenceDto | undefined => {
  const normalized = normalizeCustodyEvidence(evidence);
  return normalized
    ? {
        ...(normalized.note ? { note: normalized.note } : {}),
        ...(normalized.photo ? { photo: { file_name: normalized.photo.fileName, src: normalized.photo.src } } : {}),
      }
    : undefined;
};

export const mapEvidenceDto = (value: unknown, label: string): CustodyEvidence | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid API response: ' + label);
  const dto = value as EvidenceDto;
  if (dto.note !== undefined && typeof dto.note !== 'string')
    throw new Error('Invalid API response: ' + label + ' note');
  if (
    dto.photo !== undefined &&
    (dto.photo === null ||
      typeof dto.photo !== 'object' ||
      typeof dto.photo.file_name !== 'string' ||
      typeof dto.photo.src !== 'string')
  )
    throw new Error('Invalid API response: ' + label + ' photo');
  const note = dto.note === undefined ? undefined : nonBlankStringValue(dto.note, label + ' note').trim();
  const photo = dto.photo
    ? {
        fileName: nonBlankStringValue(dto.photo.file_name, label + ' photo file name').trim(),
        src: nonBlankStringValue(dto.photo.src, label + ' photo source').trim(),
      }
    : undefined;
  return normalizeCustodyEvidence({ ...(note ? { note } : {}), ...(photo ? { photo } : {}) });
};
