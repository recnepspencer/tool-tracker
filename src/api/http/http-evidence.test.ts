import { describe, expect, it } from 'vitest';
import { mapEvidenceDto, toEvidenceDto } from './http-evidence';

describe('custody evidence mapping', () => {
  it('normalizes notes and preserves real photo evidence', () => {
    expect(toEvidenceDto({ note: '  checked case  ' })).toEqual({ note: 'checked case' });
    expect(toEvidenceDto({ note: '   ' })).toBeUndefined();
    expect(toEvidenceDto({ photo: { fileName: ' proof.jpg ', src: ' data:image/jpeg;base64,cHJvb2Y= ' } })).toEqual({
      photo: { file_name: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' },
    });
  });

  it('maps response evidence into the same normalized domain shape', () => {
    expect(
      mapEvidenceDto(
        {
          note: '  resolution  ',
          photo: { file_name: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' },
        },
        'resolution',
      ),
    ).toEqual({
      note: 'resolution',
      photo: { fileName: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' },
    });
    expect(() => mapEvidenceDto({ note: '   ' }, 'resolution')).toThrow('resolution note');
    expect(() => mapEvidenceDto([], 'resolution')).toThrow('resolution');
  });
});
