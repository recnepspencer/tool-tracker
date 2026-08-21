import type { CustodyEvidence } from '../../domain/evidence';
import { normalizeCustodyEvidence } from '../../domain/evidence';
import { nonBlankStringValue } from './http-validation';

export interface EvidenceDto {
  note?: string;
  mock_photo?: boolean;
}

export const toEvidenceDto = (evidence?: CustodyEvidence): EvidenceDto | undefined => {
  const normalized = normalizeCustodyEvidence(evidence);
  return normalized
    ? { ...(normalized.note ? { note: normalized.note } : {}), ...(normalized.mockPhoto ? { mock_photo: true } : {}) }
    : undefined;
};

export const mapEvidenceDto = (value: unknown, label: string): CustodyEvidence | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid API response: ' + label);
  const dto = value as EvidenceDto;
  if (dto.note !== undefined && typeof dto.note !== 'string')
    throw new Error('Invalid API response: ' + label + ' note');
  if (dto.mock_photo !== undefined && typeof dto.mock_photo !== 'boolean')
    throw new Error('Invalid API response: ' + label + ' photo');
  const note = dto.note === undefined ? undefined : nonBlankStringValue(dto.note, label + ' note').trim();
  return normalizeCustodyEvidence({ ...(note ? { note } : {}), ...(dto.mock_photo ? { mockPhoto: true } : {}) });
};
