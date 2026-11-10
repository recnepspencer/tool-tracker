// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Model } from './client';
import { groupQueue, queueHistory, queuePermissions, type QueueViewer } from './queue-groups';

type Request = Model<'RequestView'>;
type Handoff = Model<'HandoffView'>;

const MAIN = 'wh-main';
const EAST = 'wh-east';
const names = {
  tool: (id: string) => ({ drill: 'Hammer drill', meter: 'Clamp meter', saw: 'Band saw' })[id] ?? 'tool',
  warehouse: (id: string) => ({ [MAIN]: 'Main warehouse', [EAST]: 'East warehouse' })[id] ?? 'Archived warehouse',
};
const manager: QueueViewer = { membershipId: 'me', managesAll: true, managedWarehouseIds: [] };
const mainKeeper: QueueViewer = { membershipId: 'me', managesAll: false, managedWarehouseIds: [MAIN] };
const foreman: QueueViewer = { membershipId: 'me', managesAll: false, managedWarehouseIds: [] };

let sequence = 0;
function request(overrides: Partial<Request> = {}): Request {
  sequence += 1;
  return {
    id: `r${sequence}`,
    asset_id: 'drill',
    requester_id: 'ray',
    requester_name: 'Ray',
    source_custody_id: 'c1',
    status: 'pending',
    note: '',
    requested_at: `2026-11-0${(sequence % 9) + 1}T10:00:00Z`,
    revision: 1,
    decided_at: null,
    decision_note: '',
    source_warehouse_id: MAIN,
    requester_eligible: true,
    ...overrides,
  };
}
function handoff(overrides: Partial<Handoff> = {}): Handoff {
  sequence += 1;
  return {
    id: `h${sequence}`,
    asset_id: 'meter',
    source_custody_id: 'c2',
    destination_membership_id: null,
    destination_warehouse_id: MAIN,
    tool_request_id: null,
    proposed_by_id: 'ana',
    proposed_by_name: 'Ana',
    status: 'pending',
    proposed_at: `2026-11-0${(sequence % 9) + 1}T09:00:00Z`,
    resolved_at: null,
    resolved_by_id: null,
    note: '',
    resolution_note: '',
    revision: 1,
    photo_ids: [],
    source_warehouse_id: null,
    destination_name: 'Main warehouse',
    ...overrides,
  };
}

describe('groupQueue', () => {
  it('asks the warehouse manager to release or decline a pending request', () => {
    const groups = groupQueue([request({ note: 'Tomorrow' })], [], mainKeeper, names);
    expect(groups.waiting).toEqual([]);
    expect(groups.needsYou).toMatchObject([
      {
        kind: 'request',
        title: 'Ray wants the Hammer drill from Main warehouse',
        note: 'Tomorrow',
        actions: ['reject', 'approve'],
      },
    ]);
  });

  it('offers only decline when the requester can no longer take tools', () => {
    const [entry] = groupQueue([request({ requester_eligible: false })], [], manager, names).needsYou;
    expect(entry).toMatchObject({ actions: ['reject'], status: 'Ray can no longer take tools' });
  });

  it("puts the viewer's own request under waiting, with withdraw", () => {
    const groups = groupQueue([request({ requester_id: 'me', requester_name: 'Me' })], [], foreman, names);
    expect(groups.needsYou).toEqual([]);
    expect(groups.waiting).toMatchObject([
      {
        title: 'You asked for the Hammer drill from Main warehouse',
        status: 'Waiting for Main warehouse to release it',
        actions: ['withdraw'],
      },
    ]);
  });

  it('asks the requester to accept a released tool and leaves the releaser waiting on them', () => {
    const released = request({ status: 'approved', requester_id: 'me', requester_name: 'Me' });
    const pickup = handoff({
      asset_id: 'drill',
      tool_request_id: released.id,
      destination_membership_id: 'me',
      destination_warehouse_id: null,
      destination_name: 'Me',
      source_warehouse_id: MAIN,
      proposed_by_id: 'boss',
      proposed_by_name: 'Boss',
    });
    const requester = groupQueue([released], [pickup], foreman, names);
    expect(requester.waiting).toEqual([]);
    expect(requester.needsYou).toMatchObject([
      {
        key: `handoff:${pickup.id}`,
        kind: 'pickup',
        title: 'The Hammer drill from Main warehouse is ready for you',
        actions: ['decline', 'accept'],
        request: released,
      },
    ]);

    const releaser = groupQueue(
      [{ ...released, requester_id: 'ray', requester_name: 'Ray' }],
      [{ ...pickup, destination_membership_id: 'ray', destination_name: 'Ray', proposed_by_id: 'me' }],
      mainKeeper,
      names,
    );
    expect(releaser.needsYou).toEqual([]);
    expect(releaser.waiting).toMatchObject([
      {
        kind: 'pickup',
        title: 'Main warehouse released the Hammer drill to Ray',
        status: 'Waiting for Ray to pick up',
        actions: ['cancel'],
      },
    ]);
  });

  it('asks the receiving warehouse manager to accept a return', () => {
    const groups = groupQueue([], [handoff()], mainKeeper, names);
    expect(groups.needsYou).toMatchObject([
      { kind: 'return', title: 'Ana is returning the Clamp meter to Main warehouse', actions: ['decline', 'accept'] },
    ]);
  });

  it('does not ask a manager of another warehouse to accept a return', () => {
    const keeper: QueueViewer = { membershipId: 'me', managesAll: false, managedWarehouseIds: [EAST] };
    const groups = groupQueue([], [handoff()], keeper, names);
    expect(groups.needsYou).toEqual([]);
    expect(groups.waiting).toMatchObject([{ status: 'Waiting for Main warehouse to accept', actions: [] }]);
  });

  it('asks a person to accept a tool handed to them, and the sender waits with cancel', () => {
    const transfer = handoff({
      asset_id: 'saw',
      destination_warehouse_id: null,
      destination_membership_id: 'me',
      destination_name: 'Me',
      proposed_by_id: 'joe',
      proposed_by_name: 'Joe',
    });
    expect(groupQueue([], [transfer], foreman, names).needsYou).toMatchObject([
      { kind: 'transfer', title: 'Joe is handing you the Band saw', actions: ['decline', 'accept'] },
    ]);
    const sent = { ...transfer, proposed_by_id: 'me', destination_membership_id: 'joe', destination_name: 'Joe' };
    expect(groupQueue([], [sent], foreman, names).waiting).toMatchObject([
      {
        title: "You're handing Joe the Band saw",
        status: 'Waiting for Joe to accept',
        actions: ['cancel'],
      },
    ]);
  });

  it('describes a warehouse sending a tool to a person', () => {
    const issue = handoff({
      destination_warehouse_id: null,
      destination_membership_id: 'ray',
      destination_name: 'Ray',
      source_warehouse_id: MAIN,
      proposed_by_id: 'boss',
      proposed_by_name: 'Boss',
    });
    expect(groupQueue([], [issue], manager, names).waiting).toMatchObject([
      { title: 'Boss is sending Ray the Clamp meter from Main warehouse', status: 'Waiting for Ray to accept' },
    ]);
  });

  it('lists the oldest ask first and ignores resolved records', () => {
    const later = request({ requested_at: '2026-11-08T10:00:00Z' });
    const earlier = request({ requested_at: '2026-11-01T10:00:00Z' });
    const done = request({ status: 'fulfilled' });
    const groups = groupQueue([later, earlier, done], [handoff({ status: 'accepted' })], manager, names);
    expect(groups.needsYou.map((entry) => entry.request?.id)).toEqual([earlier.id, later.id]);
    expect(groups.waiting).toEqual([]);
  });
});

describe('queuePermissions', () => {
  it('lets a warehouse manager decide only requests from their warehouse', () => {
    const permissions = queuePermissions(mainKeeper);
    expect(permissions.request(request())).toEqual({ approve: true, reject: true, withdraw: false });
    expect(permissions.request(request({ source_warehouse_id: EAST }))).toEqual({
      approve: false,
      reject: false,
      withdraw: false,
    });
  });

  it('lets the responsible warehouse stop a handoff it is not party to', () => {
    const permissions = queuePermissions(mainKeeper);
    const fromPerson = handoff({ destination_warehouse_id: EAST, destination_name: 'East warehouse' });
    expect(permissions.handoff(fromPerson, { responsible_warehouse_id: MAIN })).toEqual({
      receiving: false,
      cancelling: false,
      voidAllowed: true,
    });
  });
});

describe('queueHistory', () => {
  it('lists decisions newest first and tells a fulfilled request once', () => {
    const fulfilled = request({ status: 'fulfilled', decided_at: '2026-11-03T10:00:00Z', decision_note: 'Got it' });
    const pickup = handoff({ status: 'accepted', tool_request_id: fulfilled.id, resolved_at: '2026-11-04T10:00:00Z' });
    const declined = handoff({ status: 'declined', resolved_at: '2026-11-05T10:00:00Z' });
    const entries = queueHistory([fulfilled, request()], [pickup, declined, handoff()], names);
    expect(entries.map((entry) => [entry.title, entry.outcome])).toEqual([
      ['Ana sent the Clamp meter to Main warehouse', 'Declined'],
      ['Ray asked for the Hammer drill from Main warehouse', 'Picked up'],
    ]);
    expect(entries[1]!.note).toBe('Got it');
  });
});
