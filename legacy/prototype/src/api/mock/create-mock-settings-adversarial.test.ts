import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('mock settings adversarial authority', () => {
  it('rejects unauthorized and stale writes without changing the database', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const company = await api.settings.getCompany({ actorId: 'sam-ochoa' });
    const before = database.read();
    await expect(
      api.settings.updateCompany({
        actorId: 'ray-torres',
        expectedRevision: company.revision,
        name: 'Unauthorized',
        address: 'Nowhere',
      }),
    ).rejects.toThrow('active administrator');
    await expect(
      api.settings.updateCompany({
        actorId: 'sam-ochoa',
        expectedRevision: company.revision + 1,
        name: 'Stale',
        address: 'Nowhere',
      }),
    ).rejects.toThrow('changed');
    expect(database.read()).toEqual(before);
  });

  it('normalizes duplicate category names and protects used IDs while allowing unused deletion', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    await expect(api.settings.createCategory({ actorId: 'sam-ochoa', name: ' power TOOLS ' })).rejects.toThrow(
      'already exists',
    );
    const created = await api.settings.createCategory({ actorId: 'sam-ochoa', name: ' Safety ' });
    expect(created.operation).toBe('create-category');
    const safety = (await api.settings.listCategories({ actorId: 'sam-ochoa' })).find(
      (category) => category.name === 'Safety',
    );
    expect(safety).toBeDefined();
    await api.settings.deleteCategory({
      actorId: 'sam-ochoa',
      categoryId: safety!.id,
      expectedRevision: safety!.revision,
    });
    await expect(api.settings.listCategories({ actorId: 'sam-ochoa' })).resolves.not.toContainEqual(
      expect.objectContaining({ id: safety!.id }),
    );
    const power = (await api.settings.listCategories({ actorId: 'sam-ochoa' })).find(
      (category) => category.name === 'Power tools',
    )!;
    await expect(
      api.settings.deleteCategory({ actorId: 'sam-ochoa', categoryId: power.id, expectedRevision: power.revision }),
    ).rejects.toThrow('Used categories');
  });

  it('requires exact reset confirmation and restores canonical state', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const company = await api.settings.getCompany({ actorId: 'sam-ochoa' });
    await api.settings.updateCompany({
      actorId: 'sam-ochoa',
      expectedRevision: company.revision,
      name: 'Changed',
      address: 'Changed',
    });
    await expect(
      api.settings.resetDemoData({ actorId: 'sam-ochoa', confirmation: ' RESET WORKSPACE DATA ' }),
    ).rejects.toThrow('Type RESET WORKSPACE DATA');
    await expect(
      api.settings.resetDemoData({ actorId: 'sam-ochoa', confirmation: 'RESET WORKSPACE DATA' }),
    ).resolves.toEqual({
      operation: 'reset-demo-data',
      seedRevision: 'seed-v1',
    });
    await expect(api.settings.getCompany({ actorId: 'sam-ochoa' })).resolves.toMatchObject({ name: 'Nelson Electric' });
  });
});
