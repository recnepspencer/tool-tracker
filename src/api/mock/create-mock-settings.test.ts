import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';
import { createSeedState } from './seed';

describe('mock settings authority', () => {
  it('renames company and categories through stable IDs and rejects used deletion', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T10:00:00-06:00' });
    const api = createMockApi(database);
    const company = await api.settings.getCompany({ actorId: 'sam-ochoa' });
    await api.settings.updateCompany({
      actorId: 'sam-ochoa',
      expectedRevision: company.revision,
      name: 'Nelson Electric West',
      address: '1 New Ave',
    });
    expect((await api.settings.getCompany({ actorId: 'sam-ochoa' })).name).toBe('Nelson Electric West');
    const category = (await api.settings.listCategories({ actorId: 'sam-ochoa' })).find(
      (item) => item.name === 'Power tools',
    )!;
    await api.settings.renameCategory({
      actorId: 'sam-ochoa',
      categoryId: category.id,
      expectedRevision: category.revision,
      name: 'Powered tools',
    });
    expect((await api.tools.getToolDetail('TL-101')).tool.category).toBe('Powered tools');
    await expect(
      api.settings.deleteCategory({ actorId: 'sam-ochoa', categoryId: category.id, expectedRevision: 2 }),
    ).rejects.toThrow('Used categories');
  });

  it('reset restores a deep-fresh seed and deterministic ID sequence without changing theme/session authorities', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T10:00:00-06:00' });
    const api = createMockApi(database);
    const company = await api.settings.getCompany({ actorId: 'sam-ochoa' });
    await api.settings.updateCompany({
      actorId: 'sam-ochoa',
      expectedRevision: company.revision,
      name: 'Changed',
      address: 'Changed',
    });
    await expect(api.settings.resetDemoData({ actorId: 'sam-ochoa', confirmation: 'reset demo data' })).rejects.toThrow(
      'RESET DEMO DATA',
    );
    await expect(
      api.settings.resetDemoData({ actorId: 'sam-ochoa', confirmation: 'RESET DEMO DATA' }),
    ).resolves.toEqual({ operation: 'reset-demo-data', seedRevision: 'seed-v1' });
    expect(database.read()).toEqual(createSeedState());
    expect(database.nextId('EV')).toBe('EV-7');
  });
});
