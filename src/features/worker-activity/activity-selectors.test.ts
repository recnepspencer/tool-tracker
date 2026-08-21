import { describe, expect, it } from 'vitest';
import type { ActivityView } from '../../domain/read-models/activity';
import { filterActivity, groupActivity } from './activity-selectors';

const events: ActivityView[] = [
  {
    id: 'EV-1',
    actorId: 'sam-ochoa',
    actor: 'Sam Ochoa',
    action: 'Added a tool',
    toolUnitId: 'TL-1',
    toolName: 'Hammer drill',
    imageSrc: './tool-images/hammer-drill.png',
    time: 'Today · 9:12 am',
    timestamp: '2026-08-17T09:12:00-06:00',
    kind: 'admin',
    scope: 'warehouse',
    participantIds: [],
    warehouseId: 'north-yard',
    warehouseName: 'North Yard',
  },
  {
    id: 'EV-2',
    actorId: 'ray-torres',
    actor: 'Ray Torres',
    action: 'Reported a tool damaged',
    toolUnitId: 'TL-2',
    toolName: 'Fish tape',
    imageSrc: './tool-images/fish-tape.png',
    time: 'Yesterday · 9:12 am',
    timestamp: '2026-08-16T09:12:00-06:00',
    kind: 'flag',
    scope: 'damage',
    participantIds: ['ray-torres'],
    warehouseId: 'riverside-depot',
    warehouseName: 'Riverside Depot',
  },
];

describe('activity selectors', () => {
  it('keeps Mine, Warehouse, and Damage filters tied to canonical event facts', () => {
    expect(filterActivity(events, 'mine', 'ray-torres').map((event) => event.id)).toEqual(['EV-2']);
    expect(filterActivity(events, 'warehouse', 'ray-torres').map((event) => event.id)).toEqual(['EV-1']);
    expect(filterActivity(events, 'damage', 'ray-torres').map((event) => event.id)).toEqual(['EV-2']);
  });

  it('keeps participant and scope filters independent of actor role or display copy', () => {
    const incoming: ActivityView = {
      ...events[0],
      id: 'EV-3',
      actorId: 'sam-ochoa',
      actor: 'Sam Ochoa',
      action: 'Requested a handoff for Ray',
      kind: 'request',
      scope: 'worker',
      participantIds: ['ray-torres'],
      timestamp: '2026-08-17T10:18:00-06:00',
    };
    const nonAdminWarehouse: ActivityView = {
      ...events[1],
      id: 'EV-4',
      actorId: 'ray-torres',
      actor: 'Ray Torres',
      action: 'Checked in at South Shop',
      kind: 'custody',
      scope: 'warehouse',
      participantIds: ['sam-ochoa'],
      timestamp: '2026-08-17T08:00:00-06:00',
    };
    const mixed = [...events, incoming, nonAdminWarehouse];
    expect(filterActivity(mixed, 'mine', 'ray-torres').map((event) => event.id)).toEqual(['EV-2', 'EV-3']);
    expect(filterActivity(mixed, 'warehouse', 'ray-torres').map((event) => event.id)).toEqual(['EV-1', 'EV-4']);
    expect(filterActivity(mixed, 'damage', 'ray-torres').map((event) => event.id)).toEqual(['EV-2']);
  });

  it('groups the feed by the visible day label without dropping order', () => {
    expect(groupActivity(events).map((group) => [group.label, group.items.map((event) => event.id)])).toEqual([
      ['Aug 17, 2026', ['EV-1']],
      ['Aug 16, 2026', ['EV-2']],
    ]);
  });

  it('orders valid ISO timestamps by instant across timezone offsets and preserves unknown-time order', () => {
    const laterUtc = { ...events[0], id: 'EV-3', timestamp: '2026-08-17T16:30:00Z' };
    const earlierMountain = { ...events[1], id: 'EV-4', timestamp: '2026-08-17T09:00:00-06:00' };
    const unknown = { ...events[0], id: 'EV-5', timestamp: 'Today · 7:00 am' };
    expect(
      groupActivity([earlierMountain, unknown, laterUtc]).flatMap((group) => group.items.map((event) => event.id)),
    ).toEqual(['EV-3', 'EV-4', 'EV-5']);
  });

  it('groups events across the Denver local-day boundary from canonical instants', () => {
    const beforeMidnight = { ...events[0], id: 'EV-before-midnight', timestamp: '2026-08-17T05:30:00Z' };
    const afterMidnight = { ...events[1], id: 'EV-after-midnight', timestamp: '2026-08-17T06:30:00Z' };
    expect(groupActivity([beforeMidnight, afterMidnight]).map((group) => [group.label, group.items[0].id])).toEqual([
      ['Aug 17, 2026', 'EV-after-midnight'],
      ['Aug 16, 2026', 'EV-before-midnight'],
    ]);
  });
});
