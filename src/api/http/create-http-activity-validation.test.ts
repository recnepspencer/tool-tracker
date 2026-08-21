import { describe, expect, it } from 'vitest';
import { apiFor, validActivity } from './http-validation-fixtures';

describe('createHttpApi activity validation', () => {
  it('rejects malformed participants, instants, and duplicate activity IDs', async () => {
    await expect(
      apiFor('/api/activity', [{ ...validActivity, participant_ids: ['ray-torres', 7] }]).activity.listActivity(),
    ).rejects.toThrow('activity participant 1');
    await expect(
      apiFor('/api/activity', [{ ...validActivity, occurred_at: 'not-an-instant' }]).activity.listActivity(),
    ).rejects.toThrow('activity timestamp');
    for (const occurredAt of ['2026-08-17', '2026-02-30T10:00:00Z', '0', '2026-08-17T10:18:00']) {
      await expect(
        apiFor('/api/activity', [{ ...validActivity, occurred_at: occurredAt }]).activity.listActivity(),
      ).rejects.toThrow('activity timestamp');
    }
    await expect(
      apiFor('/api/activity', [
        validActivity,
        { ...validActivity, action: 'Duplicate activity' },
      ]).activity.listActivity(),
    ).rejects.toThrow('activity ids');
  });
});
