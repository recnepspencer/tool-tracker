// @vitest-environment node
import { expect, it } from 'vitest';
import { safeNext } from './navigation';

it('retains a private destination and its filters through authentication', () => {
  expect(safeNext('/app/tools?search=UNIT-001#history')).toBe('/app/tools?search=UNIT-001#history');
  expect(safeNext('/invite/a-valid_token?from=email')).toBe('/invite/a-valid_token?from=email');
});

it('rejects external, protocol-relative and malformed return destinations', () => {
  for (const value of [
    'https://other.example/app',
    '//other.example/app',
    '/\\other.example/app',
    'javascript:alert(1)',
    '/login',
    '/app\n',
    null,
  ])
    expect(safeNext(value)).toBe('/app');
});
