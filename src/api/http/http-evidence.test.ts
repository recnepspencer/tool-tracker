import { describe, expect, it } from 'vitest';
import { mapEvidenceDto, toEvidenceDto } from './http-evidence';

describe('custody evidence mapping', () => {
  it('normalizes notes and preserves an explicit mock-photo flag', () => {
    expect(toEvidenceDto({ note: '  checked case  ', mockPhoto: false })).toEqual({ note: 'checked case' });
    expect(toEvidenceDto({ note: '   ', mockPhoto: false })).toBeUndefined();
    expect(toEvidenceDto({ mockPhoto: true })).toEqual({ mock_photo: true });
  });

  it('maps response evidence into the same normalized domain shape', () => {
    expect(mapEvidenceDto({ note: '  resolution  ', mock_photo: true }, 'resolution')).toEqual({
      note: 'resolution',
      mockPhoto: true,
    });
    expect(() => mapEvidenceDto({ note: '   ' }, 'resolution')).toThrow('resolution note');
    expect(() => mapEvidenceDto([], 'resolution')).toThrow('resolution');
  });
});
