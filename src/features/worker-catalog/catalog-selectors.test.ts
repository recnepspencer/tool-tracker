import { describe, expect, it } from 'vitest';
import type { ToolCatalogItem } from '../../domain/read-models/tools';
import { filterCatalog, scopeCatalogItem } from './catalog-selectors';

const items: ToolCatalogItem[] = [
  {
    id: 'def-drill',
    name: 'Hammer drill',
    brand: 'DeWalt',
    model: 'DCD996',
    category: 'Power tools',
    imageSrc: './tool-images/hammer-drill.png',
    unitIds: ['TL-1', 'TL-3'],
    units: [
      { id: 'TL-1', warehouseId: 'north-yard', status: 'in-stock' },
      { id: 'TL-3', warehouseId: 'south-shop', status: 'checked-out' },
    ],
    totalCount: 2,
    availableCount: 1,
    checkedOutCount: 1,
    damagedCount: 0,
    lostCount: 0,
    warehouses: [
      { id: 'north-yard', name: 'North Yard', unitCount: 1 },
      { id: 'south-shop', name: 'South Shop', unitCount: 1 },
    ],
  },
  {
    id: 'def-meter',
    name: 'Fluke 87V multimeter',
    brand: 'Fluke',
    model: '87V',
    category: 'Meters & testers',
    imageSrc: './tool-images/multimeter.png',
    unitIds: ['TL-2'],
    units: [{ id: 'TL-2', warehouseId: 'south-shop', status: 'lost' }],
    totalCount: 1,
    availableCount: 0,
    checkedOutCount: 0,
    damagedCount: 0,
    lostCount: 1,
    warehouses: [{ id: 'south-shop', name: 'South Shop', unitCount: 1 }],
  },
  {
    id: 'def-fish-tape',
    name: 'Fish tape, 240 ft',
    brand: 'Klein',
    model: '56008',
    category: 'Hand tools',
    imageSrc: './tool-images/fish-tape.png',
    unitIds: ['TL-4'],
    units: [{ id: 'TL-4', warehouseId: 'riverside-depot', status: 'damaged' }],
    totalCount: 1,
    availableCount: 0,
    checkedOutCount: 0,
    damagedCount: 1,
    lostCount: 0,
    warehouses: [{ id: 'riverside-depot', name: 'Riverside Depot', unitCount: 1 }],
  },
];

describe('catalog selectors', () => {
  it('keeps aggregate counts consistent with unit-level status facts', () => {
    items.forEach((item) => {
      expect(item.totalCount).toBe(item.units.length);
      expect(item.availableCount).toBe(item.units.filter((unit) => unit.status === 'in-stock').length);
      expect(item.checkedOutCount).toBe(item.units.filter((unit) => unit.status === 'checked-out').length);
      expect(item.damagedCount).toBe(item.units.filter((unit) => unit.status === 'damaged').length);
      expect(item.lostCount).toBe(item.units.filter((unit) => unit.status === 'lost').length);
    });
  });

  it('combines search, warehouse, category, and availability constraints', () => {
    expect(
      filterCatalog(items, {
        search: 'dewalt',
        warehouseId: 'north-yard',
        category: 'Power tools',
        availability: 'available',
      }).map((item) => item.id),
    ).toEqual(['def-drill']);
    expect(
      filterCatalog(items, {
        search: '',
        warehouseId: 'north-yard',
        category: 'all',
        availability: 'checked-out',
      }),
    ).toEqual([]);
    expect(
      filterCatalog(items, {
        search: '  HAMMER  ',
        warehouseId: 'south-shop',
        category: 'Power tools',
        availability: 'available',
      }),
    ).toEqual([]);
    expect(
      filterCatalog(items, {
        search: '',
        warehouseId: 'south-shop',
        category: 'all',
        availability: 'checked-out',
      }).map((item) => item.id),
    ).toEqual(['def-drill']);
    expect(
      filterCatalog(items, {
        search: '',
        warehouseId: 'south-shop',
        category: 'all',
        availability: 'lost',
      }).map((item) => item.id),
    ).toEqual(['def-meter']);
    expect(
      filterCatalog(items, {
        search: '',
        warehouseId: 'riverside-depot',
        category: 'all',
        availability: 'damaged',
      }).map((item) => item.id),
    ).toEqual(['def-fish-tape']);
    expect(
      filterCatalog(items, {
        search: 'not-a-tool',
        warehouseId: 'all',
        category: 'all',
        availability: 'all',
      }),
    ).toEqual([]);
  });

  it('keeps damaged and lost availability branches distinct', () => {
    expect(
      filterCatalog(items, { search: '', warehouseId: 'all', category: 'all', availability: 'damaged' })[0].lostCount,
    ).toBe(0);
    expect(
      filterCatalog(items, { search: '', warehouseId: 'all', category: 'all', availability: 'lost' })[0].damagedCount,
    ).toBe(0);
  });

  it('scopes card counts, locations, and unit actions to the active filters', () => {
    const scoped = scopeCatalogItem(items[0], {
      search: '',
      warehouseId: 'south-shop',
      category: 'all',
      availability: 'checked-out',
    });
    expect(scoped).toMatchObject({
      unitIds: ['TL-3'],
      totalCount: 1,
      availableCount: 0,
      checkedOutCount: 1,
      damagedCount: 0,
      lostCount: 0,
      warehouses: [{ id: 'south-shop', name: 'South Shop', unitCount: 1 }],
    });
  });

  it('keeps damaged and lost scoped card counts distinct', () => {
    expect(
      scopeCatalogItem(items[2], {
        search: '',
        warehouseId: 'riverside-depot',
        category: 'all',
        availability: 'damaged',
      }),
    ).toMatchObject({ totalCount: 1, availableCount: 0, checkedOutCount: 0, damagedCount: 1, lostCount: 0 });
    expect(
      scopeCatalogItem(items[1], {
        search: '',
        warehouseId: 'south-shop',
        category: 'all',
        availability: 'lost',
      }),
    ).toMatchObject({ totalCount: 1, availableCount: 0, checkedOutCount: 0, damagedCount: 0, lostCount: 1 });
  });
});
