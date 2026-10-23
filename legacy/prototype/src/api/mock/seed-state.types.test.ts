import { describe, expect, it } from 'vitest';
import type { SeedSnapshot } from './seed-state';

const projectionCannotMutateSnapshots = (snapshot: SeedSnapshot) => {
  // @ts-expect-error Read-side snapshots are deeply immutable by contract.
  snapshot.users[0].name = 'mutated';
  // @ts-expect-error Read-side snapshots protect nested holder records too.
  snapshot.custody[0].holder = { type: 'worker', userId: 'mutated' };
};

void projectionCannotMutateSnapshots;

describe('seed snapshot types', () => {
  it('keeps projection snapshots read-only at compile time', () => {
    expect(projectionCannotMutateSnapshots).toBeTypeOf('function');
  });
});
