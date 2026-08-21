import { describe, expect, it } from 'vitest';
import { adminPersonPath } from './admin-person-path';

describe('admin person paths', () => {
  it('encodes opaque IDs as one route segment', () => {
    expect(adminPersonPath('avery/cole')).toBe('/admin/people/avery%2Fcole');
    expect(adminPersonPath('avery cole')).toBe('/admin/people/avery%20cole');
  });
});
