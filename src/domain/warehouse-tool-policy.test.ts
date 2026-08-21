import { describe, expect, it } from 'vitest';
import { warehouseToolDecisionPolicy } from './warehouse-tool-policy';
import type { HolderRef } from './custody';

const warehouse = { type: 'warehouse', warehouseId: 'north-yard' } satisfies HolderRef;
const worker = { type: 'worker', userId: 'ray-torres' } satisfies HolderRef;

describe('warehouse tool decision policy', () => {
  it('exposes only serviceable warehouse flagging and flagged lifecycle actions', () => {
    expect(
      warehouseToolDecisionPolicy({
        lifecycle: 'active',
        condition: 'serviceable',
        status: 'in-stock',
        holder: warehouse,
      }),
    ).toEqual({ canEdit: true, canFlag: true, canRestore: false, canForceReturn: false, canDecommission: true });
    expect(
      warehouseToolDecisionPolicy({ lifecycle: 'active', condition: 'damaged', status: 'damaged', holder: warehouse }),
    ).toEqual({ canEdit: true, canFlag: false, canRestore: true, canForceReturn: false, canDecommission: true });
  });

  it('requires a worker-held flagged unit for force return and closes archived actions', () => {
    expect(
      warehouseToolDecisionPolicy({ lifecycle: 'active', condition: 'lost', status: 'lost', holder: worker }),
    ).toEqual({ canEdit: true, canFlag: false, canRestore: false, canForceReturn: true, canDecommission: false });
    expect(
      warehouseToolDecisionPolicy({ lifecycle: 'archived', condition: 'lost', status: 'lost', holder: warehouse }),
    ).toEqual({ canEdit: false, canFlag: false, canRestore: false, canForceReturn: false, canDecommission: false });
  });
});
