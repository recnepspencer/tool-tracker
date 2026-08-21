import { describe, expect, it } from 'vitest';
import { apiFor, validActivity, validCatalog, validDetail, validTool } from './http-validation-fixtures';

describe('createHttpApi tool validation', () => {
  it('rejects invalid tool status, holders, and duplicate tool IDs', async () => {
    await expect(
      apiFor('/api/tools', [{ ...validTool, last_moved_at: 'Held 6 days' }]).tools.listTools(),
    ).rejects.toThrow('tool movement time');
    await expect(apiFor('/api/tools', [{ ...validTool, revision: 0 }]).tools.listTools()).rejects.toThrow(
      'tool revision',
    );
    await expect(
      apiFor('/api/tools', [{ ...validTool, revision: Number.MAX_SAFE_INTEGER + 1 }]).tools.listTools(),
    ).rejects.toThrow('tool revision');
    await expect(apiFor('/api/tools', [{ ...validTool, display_status: 'unknown' }]).tools.listTools()).rejects.toThrow(
      'tool status',
    );
    await expect(
      apiFor('/api/tools', [
        { ...validTool, holder: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' } },
      ]).tools.listTools(),
    ).rejects.toThrow('tool status/holder');
    await expect(
      apiFor('/api/tools', [
        {
          ...validTool,
          display_status: 'checked-out',
          holder: { kind: 'warehouse', id: 'north-yard', label: 'North Yard' },
        },
      ]).tools.listTools(),
    ).rejects.toThrow('tool status/holder');
    await expect(
      apiFor('/api/tools', [validTool, { ...validTool, display_name: 'Duplicate tool' }]).tools.listTools(),
    ).rejects.toThrow('tool ids');
  });

  it('rejects malformed catalog counts and references', async () => {
    await expect(
      apiFor('/api/tools/catalog', [{ ...validCatalog, total_count: '1' }]).tools.listCatalog(),
    ).rejects.toThrow('catalog total count');
    await expect(
      apiFor('/api/tools/catalog', [{ ...validCatalog, total_count: -1 }]).tools.listCatalog(),
    ).rejects.toThrow('catalog total count');
    await expect(
      apiFor('/api/tools/catalog', [{ ...validCatalog, total_count: 1.5 }]).tools.listCatalog(),
    ).rejects.toThrow('catalog total count');
    await expect(
      apiFor('/api/tools/catalog', [{ ...validCatalog, available_count: 0 }]).tools.listCatalog(),
    ).rejects.toThrow('catalog aggregate counts');
    await expect(
      apiFor('/api/tools/catalog', [
        {
          ...validCatalog,
          units: [
            { unit_id: 'TL-101', warehouse_id: 'north-yard', display_status: 'in-stock' },
            { unit_id: 'TL-101', warehouse_id: 'north-yard', display_status: 'in-stock' },
          ],
          unit_ids: ['TL-101', 'TL-101'],
          total_count: 2,
          available_count: 2,
        },
      ]).tools.listCatalog(),
    ).rejects.toThrow('catalog unit references');
    await expect(
      apiFor('/api/tools/catalog', [
        validCatalog,
        {
          ...validCatalog,
          units: [{ unit_id: 'TL-202', warehouse_id: 'north-yard', display_status: 'in-stock' }],
          unit_ids: ['TL-202'],
          definition_id: validCatalog.definition_id,
        },
      ]).tools.listCatalog(),
    ).rejects.toThrow('catalog definition ids');
    await expect(
      apiFor('/api/tools/catalog', [
        { ...validCatalog, warehouses: [{ warehouse_id: 'north-yard', name: 'North Yard', unit_count: 2 }] },
      ]).tools.listCatalog(),
    ).rejects.toThrow('catalog warehouse counts');
  });

  it('rejects inconsistent tool detail condition, identity, and timeline references', async () => {
    await expect(
      apiFor('/api/tools/TL-101', { ...validDetail, condition: 'missing' }).tools.getToolDetail('TL-101'),
    ).rejects.toThrow('tool detail condition');
    await expect(
      apiFor('/api/tools/TL-101', { ...validDetail, condition: 'damaged' }).tools.getToolDetail('TL-101'),
    ).rejects.toThrow('tool detail condition/status');
    await expect(
      apiFor('/api/tools/TL-101', {
        ...validDetail,
        tool: { ...validTool, display_status: 'damaged' },
        condition: 'lost',
      }).tools.getToolDetail('TL-101'),
    ).rejects.toThrow('tool detail condition/status');
    await expect(
      apiFor('/api/tools/TL-101', {
        ...validDetail,
        tool: { ...validTool, display_status: 'lost' },
        condition: 'damaged',
      }).tools.getToolDetail('TL-101'),
    ).rejects.toThrow('tool detail condition/status');
    await expect(
      apiFor('/api/tools/TL-101', {
        ...validDetail,
        tool: { ...validTool, tool_id: 'TL-999' },
      }).tools.getToolDetail('TL-101'),
    ).rejects.toThrow('tool detail id');
  });

  it('rejects detail timelines for another unit or duplicate events', async () => {
    await expect(
      apiFor('/api/tools/TL-101', {
        ...validDetail,
        timeline: [{ ...validActivity, tool_unit_id: 'TL-999' }],
      }).tools.getToolDetail('TL-101'),
    ).rejects.toThrow('tool detail timeline unit');
    await expect(
      apiFor('/api/tools/TL-101', {
        ...validDetail,
        timeline: [validActivity, { ...validActivity, action: 'Duplicate event' }],
      }).tools.getToolDetail('TL-101'),
    ).rejects.toThrow('tool detail timeline event ids');
  });
});
