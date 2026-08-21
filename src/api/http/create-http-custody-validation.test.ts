import { describe, expect, it } from 'vitest';
import { apiFor, validHandoff } from './http-validation-fixtures';

describe('createHttpApi custody validation', () => {
  it('rejects malformed, unauthorized, and duplicate pending handoffs', async () => {
    const path = '/api/tools/pending-handoffs?profile_id=ray-torres';
    await expect(
      apiFor(path, [
        { ...validHandoff, from: { kind: 'contractor', id: 'north-yard', label: 'North Yard' } },
      ]).custody.listPendingHandoffs('ray-torres'),
    ).rejects.toThrow('holder kind');
    await expect(
      apiFor(path, [{ ...validHandoff, requested_at: 'not-an-instant' }]).custody.listPendingHandoffs('ray-torres'),
    ).rejects.toThrow('handoff time');
    await expect(
      apiFor(path, [
        {
          ...validHandoff,
          requested_by_id: 'sam-ochoa',
          to: { kind: 'worker', id: 'sam-ochoa', label: 'Sam Ochoa' },
        },
      ]).custody.listPendingHandoffs('ray-torres'),
    ).rejects.toThrow('pending handoff profile');
    await expect(
      apiFor(path, [validHandoff, { ...validHandoff }]).custody.listPendingHandoffs('ray-torres'),
    ).rejects.toThrow('pending handoff ids');
    await expect(
      apiFor(path, [validHandoff, { ...validHandoff, handoff_id: 'HO-2' }]).custody.listPendingHandoffs('ray-torres'),
    ).rejects.toThrow('pending handoff tool ids');
    await expect(
      apiFor(path, [
        {
          ...validHandoff,
          kind: 'transfer',
          from: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
          to: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
          requested_by_id: 'ray-torres',
          requested_by: 'Ray Torres',
        },
      ]).custody.listPendingHandoffs('ray-torres'),
    ).rejects.toThrow('self-transfer');
  });

  it('keeps incoming and outgoing participant handoffs visible', async () => {
    const path = '/api/tools/pending-handoffs?profile_id=ray-torres';
    await expect(
      apiFor(path, [
        {
          ...validHandoff,
          handoff_id: 'HO-incoming',
          kind: 'transfer',
          requested_by_id: 'jordan-lee',
          requested_by: 'Jordan Lee',
          from: { kind: 'worker', id: 'jordan-lee', label: 'Jordan Lee' },
          to: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
        },
        {
          ...validHandoff,
          handoff_id: 'HO-outgoing',
          tool_unit_id: 'TL-102',
          kind: 'transfer',
          requested_by_id: 'ray-torres',
          requested_by: 'Ray Torres',
          from: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
          to: { kind: 'warehouse', id: 'north-yard', label: 'North Yard' },
        },
      ]).custody.listPendingHandoffs('ray-torres'),
    ).resolves.toMatchObject([{ id: 'HO-incoming' }, { id: 'HO-outgoing' }]);
  });

  it('rejects archived pending handoffs at the transport boundary', async () => {
    const path = '/api/tools/pending-handoffs?profile_id=ray-torres';
    await expect(
      apiFor(path, [{ ...validHandoff, lifecycle: 'archived' }]).custody.listPendingHandoffs('ray-torres'),
    ).rejects.toThrow('archived pending handoff');
  });

  it('preserves pending evidence and rejects unknown kinds or malformed photo flags', async () => {
    const path = '/api/tools/pending-handoffs?profile_id=ray-torres';
    await expect(
      apiFor(path, [
        { ...validHandoff, evidence: { note: '  bring bit ', mock_photo: true } },
      ]).custody.listPendingHandoffs('ray-torres'),
    ).resolves.toMatchObject([{ evidence: { note: 'bring bit', mockPhoto: true } }]);
    await expect(
      apiFor(path, [{ ...validHandoff, kind: 'unknown' }]).custody.listPendingHandoffs('ray-torres'),
    ).rejects.toThrow('handoff kind');
    await expect(
      apiFor(path, [{ ...validHandoff, evidence: { mock_photo: 1 } }]).custody.listPendingHandoffs('ray-torres'),
    ).rejects.toThrow('handoff evidence photo');
  });
});
