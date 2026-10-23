import { describe, expect, it } from 'vitest';
import {
  apiFor,
  validActivity,
  validCatalog,
  validDetail,
  validHandoff,
  validProfile,
  validSummary,
  validSummaryEvent,
  validTool,
  validWarehouse,
} from './http-validation-fixtures';

describe('createHttpApi adversarial field validation', () => {
  it('rejects malformed activity and admin event fields', async () => {
    await expect(
      apiFor('/api/activity', [{ ...validActivity, kind: 'unknown' }]).activity.listActivity(),
    ).rejects.toThrow('activity kind');
    await expect(
      apiFor('/api/activity', [{ ...validActivity, action: '   ' }]).activity.listActivity(),
    ).rejects.toThrow('activity action');

    for (const [field, value, message] of [
      ['event_id', 7, 'event id'],
      ['actor_name', 7, 'event actor'],
      ['action', 7, 'event action'],
      ['kind', 'unknown', 'event kind'],
    ] as const) {
      await expect(
        apiFor('/api/admin/summary?actor_id=sam-ochoa', {
          ...validSummary,
          recent_events: [{ ...validSummaryEvent, [field]: value }],
        }).admin.getSummary(),
      ).rejects.toThrow(message);
    }

    await expect(
      apiFor('/api/tools/catalog', [
        { ...validCatalog, unit_ids: ['   '], units: [{ ...validCatalog.units[0], unit_id: '   ' }] },
      ]).tools.listCatalog(),
    ).rejects.toThrow('catalog unit id');
    await expect(
      apiFor('/api/tools/catalog', [{ ...validCatalog, image_url: '   ' }]).tools.listCatalog(),
    ).rejects.toThrow('catalog image');
    await expect(
      apiFor('/api/tools/catalog', [
        {
          ...validCatalog,
          unit_ids: [],
          units: [],
          total_count: 0,
          available_count: 0,
          checked_out_count: 0,
          warehouses: [],
        },
      ]).tools.listCatalog(),
    ).rejects.toThrow('catalog units');
    await expect(
      apiFor('/api/tools/catalog', [
        validCatalog,
        { ...validCatalog, definition_id: 'def-other', unit_ids: ['TL-101'] },
      ]).tools.listCatalog(),
    ).rejects.toThrow('catalog unit ids');
  });

  it('rejects blank required values across HTTP read-model mappers', async () => {
    await expect(
      apiFor('/api/demo-profiles', [{ ...validProfile, profile_id: ' ' }]).auth.listDemoProfiles(),
    ).rejects.toThrow('profile id');
    await expect(
      apiFor('/api/sessions/demo', { ...validProfile, email_address: ' ' }).auth.signInAs('ray-torres'),
    ).rejects.toThrow('session email');
    await expect(apiFor('/api/tools', [{ ...validTool, tool_id: ' ' }]).tools.listTools()).rejects.toThrow('tool id');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        warehouses: [{ ...validWarehouse, name: ' ' }],
      }).admin.getSummary(),
    ).rejects.toThrow('warehouse name');
    await expect(
      apiFor('/api/tools/pending-handoffs?profile_id=ray-torres', [
        { ...validHandoff, handoff_id: ' ' },
      ]).custody.listPendingHandoffs('ray-torres'),
    ).rejects.toThrow('handoff id');
    await expect(
      apiFor('/api/activity', [{ ...validActivity, event_id: ' ' }]).activity.listActivity(),
    ).rejects.toThrow('activity id');
    await expect(
      apiFor('/api/tools/TL-101', { ...validDetail, tool: { ...validTool, image_url: ' ' } }).tools.getToolDetail(
        'TL-101',
      ),
    ).rejects.toThrow('tool image');
  });
});
