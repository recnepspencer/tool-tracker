import { describe, expect, it } from 'vitest';
import { createHttpSettingsApi } from './create-http-settings-api';
import type { HttpTransport } from './create-http-api';

const mutationReceipt = (operation: string) => ({
  operation,
  correlation_id: 'SET-EV-1',
  event_id: 'EV-1',
  affected_tool_unit_ids: [],
  affected_handoff_ids: [],
});

describe('HTTP settings boundary', () => {
  it('maps company and category reads while rejecting invalid category normalization', async () => {
    const api = createHttpSettingsApi({
      transport: {
        get: (async (path: string) =>
          path.includes('/company')
            ? { company_id: 'company', name: 'Nelson Electric', address: '1 Main St', revision: 2 }
            : {
                categories: [
                  {
                    category_id: 'category-power-tools',
                    name: 'Power tools',
                    normalized_name: 'power tools',
                    revision: 1,
                    usage_count: 3,
                  },
                ],
              }) as HttpTransport['get'],
        post: (async () => mutationReceipt('update-company')) as HttpTransport['post'],
      },
    });
    await expect(api.getCompany({ actorId: 'sam-ochoa' })).resolves.toEqual({
      id: 'company',
      name: 'Nelson Electric',
      address: '1 Main St',
      revision: 2,
    });
    await expect(api.listCategories({ actorId: 'ray-torres' })).resolves.toEqual([
      {
        id: 'category-power-tools',
        name: 'Power tools',
        normalizedName: 'power tools',
        revision: 1,
        usageCount: 3,
      },
    ]);
    const invalid = createHttpSettingsApi({
      transport: {
        get: (async () => ({
          categories: [
            {
              category_id: 'category-power-tools',
              name: 'Power tools',
              normalized_name: 'wrong',
              revision: 1,
              usage_count: 3,
            },
          ],
        })) as HttpTransport['get'],
        post: (async () => mutationReceipt('update-company')) as HttpTransport['post'],
      },
    });
    await expect(invalid.listCategories({ actorId: 'sam-ochoa' })).rejects.toThrow('normalization');
  });

  it('sends stable-ID command bodies and validates settings receipts', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    let response: unknown = mutationReceipt('update-company');
    const api = createHttpSettingsApi({
      transport: {
        get: (async () => ({ categories: [] })) as HttpTransport['get'],
        post: (async <T>(path: string, body: unknown) => {
          calls.push({ path, body });
          return response as T;
        }) as HttpTransport['post'],
      },
    });
    await api.updateCompany({ actorId: 'sam-ochoa', expectedRevision: 2, name: 'Nelson West', address: '2 Main St' });
    expect(calls[0]).toEqual({
      path: '/api/admin/settings/company',
      body: { actor_id: 'sam-ochoa', expected_revision: 2, name: 'Nelson West', address: '2 Main St' },
    });
    response = mutationReceipt('create-category');
    await api.createCategory({ actorId: 'sam-ochoa', name: 'Safety' });
    expect(calls[1]).toEqual({
      path: '/api/admin/settings/categories',
      body: { actor_id: 'sam-ochoa', name: 'Safety' },
    });
    response = mutationReceipt('rename-category');
    await api.renameCategory({
      actorId: 'sam-ochoa',
      categoryId: 'category-power-tools',
      expectedRevision: 1,
      name: 'Powered tools',
    });
    expect(calls[2]).toEqual({
      path: '/api/admin/settings/categories/category-power-tools/rename',
      body: { actor_id: 'sam-ochoa', expected_revision: 1, name: 'Powered tools' },
    });
    response = mutationReceipt('delete-category');
    await api.deleteCategory({ actorId: 'sam-ochoa', categoryId: 'category-safety', expectedRevision: 1 });
    expect(calls[3]).toEqual({
      path: '/api/admin/settings/categories/category-safety/delete',
      body: { actor_id: 'sam-ochoa', expected_revision: 1 },
    });
    response = { operation: 'reset-demo-data', seed_revision: 'seed-v1' };
    await expect(api.resetDemoData({ actorId: 'sam-ochoa', confirmation: 'RESET DEMO DATA' })).resolves.toEqual({
      operation: 'reset-demo-data',
      seedRevision: 'seed-v1',
    });
    expect(calls[4]).toEqual({
      path: '/api/admin/settings/reset-demo-data',
      body: { actor_id: 'sam-ochoa', confirmation: 'RESET DEMO DATA' },
    });
    response = mutationReceipt('delete-category');
    await expect(
      api.updateCompany({ actorId: 'sam-ochoa', expectedRevision: 2, name: 'x', address: 'y' }),
    ).rejects.toThrow('mutation operation');

    response = { ...mutationReceipt('update-company'), affected_handoff_ids: ['HO-1'] };
    await expect(
      api.updateCompany({ actorId: 'sam-ochoa', expectedRevision: 2, name: 'x', address: 'y' }),
    ).rejects.toThrow('settings handoffs');

    response = { operation: 'reset-demo-data', seed_revision: '' };
    await expect(api.resetDemoData({ actorId: 'sam-ochoa', confirmation: 'RESET DEMO DATA' })).rejects.toThrow(
      'seed revision',
    );
  });

  it('rejects duplicate category IDs and normalized names', async () => {
    const duplicateId = createHttpSettingsApi({
      transport: {
        get: (async () => ({
          categories: [
            { category_id: 'category-safety', name: 'Safety', normalized_name: 'safety', revision: 1, usage_count: 0 },
            { category_id: 'category-safety', name: 'Other', normalized_name: 'other', revision: 1, usage_count: 0 },
          ],
        })) as HttpTransport['get'],
        post: (async () => mutationReceipt('update-company')) as HttpTransport['post'],
      },
    });
    await expect(duplicateId.listCategories({ actorId: 'sam-ochoa' })).rejects.toThrow('category ids');
    const duplicateName = createHttpSettingsApi({
      transport: {
        get: (async () => ({
          categories: [
            { category_id: 'category-a', name: 'Safety', normalized_name: 'safety', revision: 1, usage_count: 0 },
            { category_id: 'category-b', name: 'Safety', normalized_name: 'safety', revision: 1, usage_count: 0 },
          ],
        })) as HttpTransport['get'],
        post: (async () => mutationReceipt('update-company')) as HttpTransport['post'],
      },
    });
    await expect(duplicateName.listCategories({ actorId: 'sam-ochoa' })).rejects.toThrow('category names');
  });
});
