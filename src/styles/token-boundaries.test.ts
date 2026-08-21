import { describe, expect, it } from 'vitest';

const TOKEN_SHEET = /(?:^|\/)tokens\.css$/;
const FIELD_PRIMITIVES = /\/(TextField|SelectField)\.tsx$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;
const RGB = /\brgba?\(/i;
const PX_OR_MS = /\d+(?:\.\d+)?(?:px|ms)\b/;
const Z_INDEX = /z-index:\s*-?\d+/;
const OPACITY = /opacity:\s*(?!0(?:\s|;|!|\}|$))[\d.]+/;

function stripCssNoise(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]+/g, '@media ');
}

function findCssLiteralViolations(sources: Record<string, string>): string[] {
  return Object.entries(sources)
    .filter(([path]) => !TEST_FILE.test(path) && !TOKEN_SHEET.test(path))
    .flatMap(([path, source]) => {
      const body = stripCssNoise(source);
      const hits: string[] = [];
      if (HEX.test(body)) hits.push(`${path}: hex color`);
      if (RGB.test(body)) hits.push(`${path}: rgb color`);
      if (PX_OR_MS.test(body)) hits.push(`${path}: px/ms length`);
      if (Z_INDEX.test(body)) hits.push(`${path}: literal z-index`);
      if (OPACITY.test(body)) hits.push(`${path}: literal opacity`);
      return hits;
    });
}

function findNativeFormViolations(sources: Record<string, string>): string[] {
  return Object.entries(sources)
    .filter(([path]) => !TEST_FILE.test(path) && !FIELD_PRIMITIVES.test(path))
    .flatMap(([path, source]) => {
      const hits: string[] = [];
      if (/<input[\s>/]/.test(source)) hits.push(`${path}: native input`);
      if (/<select[\s>/]/.test(source)) hits.push(`${path}: native select`);
      if (/<textarea[\s>/]/.test(source)) hits.push(`${path}: native textarea`);
      return hits;
    });
}

describe('presentation token and field-primitive boundaries', () => {
  it('keeps native form controls inside the shared field primitives', () => {
    const sources = import.meta.glob('../**/*.tsx', {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>;
    expect(findNativeFormViolations(sources)).toEqual([]);
  });

  it('keeps production CSS on tokens instead of color, length, z-index, or opacity literals', () => {
    const sources = import.meta.glob('../**/*.css', {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>;
    expect(findCssLiteralViolations(sources)).toEqual([]);
  });

  it('flags synthetic native form tags outside the field primitives', () => {
    expect(findNativeFormViolations({ '../features/Fake.tsx': '<input value="x" />' })).toEqual([
      '../features/Fake.tsx: native input',
    ]);
    expect(findNativeFormViolations({ '../features/Fake.tsx': '<select></select>' })).toEqual([
      '../features/Fake.tsx: native select',
    ]);
    expect(findNativeFormViolations({ '../features/Fake.tsx': '<textarea></textarea>' })).toEqual([
      '../features/Fake.tsx: native textarea',
    ]);
    expect(findNativeFormViolations({ '../components/ui/TextField.tsx': '<input value="ok" />' })).toEqual([]);
  });

  it('flags synthetic CSS literals and ignores media-query breakpoints and the token sheet', () => {
    expect(findCssLiteralViolations({ '../styles/fake.css': '.x { color: #fff; }' })).toEqual([
      '../styles/fake.css: hex color',
    ]);
    expect(findCssLiteralViolations({ '../styles/fake.css': '.x { background: rgba(0, 0, 0, 0.5); }' })).toEqual([
      '../styles/fake.css: rgb color',
    ]);
    expect(findCssLiteralViolations({ '../styles/fake.css': '.x { padding: 12px; }' })).toEqual([
      '../styles/fake.css: px/ms length',
    ]);
    expect(findCssLiteralViolations({ '../styles/fake.css': '.x { transition-duration: 200ms; }' })).toEqual([
      '../styles/fake.css: px/ms length',
    ]);
    expect(findCssLiteralViolations({ '../styles/fake.css': '.x { z-index: 10; }' })).toEqual([
      '../styles/fake.css: literal z-index',
    ]);
    expect(findCssLiteralViolations({ '../styles/fake.css': '.x { opacity: 0.6; }' })).toEqual([
      '../styles/fake.css: literal opacity',
    ]);
    expect(
      findCssLiteralViolations({
        '../styles/fake.css': '@media (max-width: 620px) { .x { color: var(--ink); } }',
      }),
    ).toEqual([]);
    expect(findCssLiteralViolations({ '../styles/tokens.css': ':root { --space-8: 8px; --bg: #06080c; }' })).toEqual(
      [],
    );
    expect(findCssLiteralViolations({ '../styles/ok.css': '.x { margin: 0; width: 100%; opacity: 0; }' })).toEqual([]);
  });
});
