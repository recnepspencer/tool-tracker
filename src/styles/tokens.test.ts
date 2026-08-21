import { describe, expect, it } from 'vitest';
import { readTokenPx } from './read-token';

describe('design tokens', () => {
  it('exposes the field, switch, and overlay geometry as pixel tokens', () => {
    expect(readTokenPx('--space-8')).toBe(8);
    expect(readTokenPx('--space-16')).toBe(16);
    expect(readTokenPx('--radius-field')).toBe(14);
    expect(readTokenPx('--control-height')).toBe(44);
    expect(readTokenPx('--switch-width')).toBe(46);
    expect(readTokenPx('--switch-knob-size')).toBe(20);
    expect(readTokenPx('--listbox-max-height')).toBe(240);
    expect(readTokenPx('--listbox-gap')).toBe(6);
    expect(readTokenPx('--z-popover')).toBe(60);
  });
});
