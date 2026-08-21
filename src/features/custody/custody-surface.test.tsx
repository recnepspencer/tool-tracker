import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { chooseFieldOption } from '../../test/choose-field-option';
import { useCustodyMutations } from './use-custody-mutations';

function MutationHarness() {
  const mutations = useCustodyMutations();
  return (
    <button
      type="button"
      onClick={() => void mutations.requestTool.mutateAsync({ toolUnitId: 'TL-105', actorId: 'ray-torres' })}
    >
      Run request
    </button>
  );
}

describe('custody workflow surfaces', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/checkout';
  });

  it('requests warehouse stock with evidence without moving custody', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'Browse tools' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inspect Rotary hammer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    await user.click(within(dialog).getByRole('button', { name: 'Request from North Yard' }));
    await user.type(within(dialog).getByPlaceholderText('Add context for the record'), 'Tomorrow job');
    await user.click(within(dialog).getByRole('switch', { name: 'Attach a mock photo to this record' }));
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await within(dialog).findByText('Request sent to the warehouse.')).toBeInTheDocument();
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-105')?.holder).toEqual({
      type: 'warehouse',
      warehouseId: 'north-yard',
    });
    expect(database.read().handoffs.at(-1)).toMatchObject({ evidence: { note: 'Tomorrow job', mockPhoto: true } });
    expect(within(dialog).queryByRole('button', { name: 'Request from North Yard' })).not.toBeInTheDocument();
  });

  it('renders projected pending evidence on the worker handoff card', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      handoffs: state.handoffs.map((handoff) =>
        handoff.id === 'HO-1' ? { ...handoff, evidence: { note: 'Bring the long bit', mockPhoto: true } } : handoff,
      ),
    }));
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('ray-torres') });
    const card = await screen.findByRole('article', { name: 'Bandsaw pending handoff' });
    expect(within(card).getByText('Note: Bring the long bit')).toBeInTheDocument();
  });

  it('does not carry a completed action notice into another tool detail', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('ray-torres') });
    await user.click(await screen.findByRole('button', { name: 'Open details for Hammer drill unit TL-101' }));
    let dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    await user.click(within(dialog).getByRole('button', { name: 'Report damaged' }));
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await within(dialog).findByText('Tool reported damaged.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close tool details' }));
    await user.click(await screen.findByRole('button', { name: 'Open details for Fluke 87V multimeter unit TL-102' }));
    dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    expect(within(dialog).queryByText('Tool reported damaged.')).not.toBeInTheDocument();
  });

  it('hides terminal-condition actions for damaged and lost tools', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      custody: state.custody.map((record) =>
        record.toolUnitId === 'TL-111' ? { ...record, holder: { type: 'worker', userId: 'ray-torres' } } : record,
      ),
    }));
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('ray-torres') });
    await user.click(await screen.findByRole('button', { name: 'Open details for Fish tape, 240 ft unit TL-104' }));
    let dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    expect(within(dialog).queryByRole('button', { name: 'Report damaged' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Report lost' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close tool details' }));
    await user.click(await screen.findByRole('button', { name: 'Open details for Cable cutter unit TL-111' }));
    dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    expect(within(dialog).queryByRole('button', { name: 'Transfer tool' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Report damaged' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Report lost' })).not.toBeInTheDocument();
  });

  it('hides all worker custody actions for an archived detail record', async () => {
    const baseApi = createMockApi();
    const activeDetail = await baseApi.tools.getToolDetail('TL-101');
    const archivedApi = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        getToolDetail: async () => ({ ...activeDetail, lifecycle: 'archived' as const }),
      },
    };
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: archivedApi, sessionStore: createMemorySessionStore('ray-torres') });
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Open details for Hammer drill unit TL-101' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    expect(within(dialog).queryByRole('button', { name: 'Transfer tool' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Report damaged' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Report lost' })).not.toBeInTheDocument();
  });

  it('enters custody details with focus and restores focus after Escape', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('ray-torres') });
    const trigger = await screen.findByRole('button', { name: 'Open details for Hammer drill unit TL-101' });
    trigger.focus();
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toHaveAttribute('aria-label', 'Close tool details');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tool details' })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it('fails closed when pending handoffs cannot be checked', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        listPendingHandoffs: async () => Promise.reject(new Error('pending unavailable')),
      },
    };
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('ray-torres') });
    await user.click(await screen.findByRole('button', { name: 'Open details for Hammer drill unit TL-101' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    await waitFor(() =>
      expect(within(dialog).queryByRole('button', { name: 'Transfer tool' })).not.toBeInTheDocument(),
    );
    expect(within(dialog).queryByRole('button', { name: 'Report damaged' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Report lost' })).not.toBeInTheDocument();
  });

  it('disables transfer confirmation when destinations fail after the detail opens', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let requestStarted = false;
    let startTransferCalls = 0;
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        requestTool: async (input: Parameters<typeof baseApi.custody.requestTool>[0]) => {
          requestStarted = true;
          return baseApi.custody.requestTool(input);
        },
        startTransfer: async (input: Parameters<typeof baseApi.custody.startTransfer>[0]) => {
          startTransferCalls += 1;
          return baseApi.custody.startTransfer(input);
        },
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) =>
          requestStarted
            ? Promise.reject(new Error('targets unavailable'))
            : baseApi.custody.listTransferTargets(input),
      },
    };
    window.location.hash = '#/worker/tools';
    renderApp(
      <>
        <AppRoutes />
        <MutationHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    await user.click(await screen.findByRole('button', { name: 'Open details for Hammer drill unit TL-101' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    await user.click(within(dialog).getByRole('button', { name: 'Transfer tool' }));
    await chooseFieldOption(user, within(dialog).getByRole('combobox', { name: 'Send to' }), /South Shop/);
    expect(within(dialog).getByRole('combobox', { name: 'Send to' })).toHaveValue('South Shop');
    await user.click(screen.getByRole('button', { name: 'Run request' }));
    await waitFor(() => expect(requestStarted).toBe(true));
    expect(await within(dialog).findByText('Transfer targets could not be loaded.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(startTransferCalls).toBe(0);
  });

  it('keeps transfer evidence drafts when the adapter rejects the command', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const rejectingApi = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        startTransfer: async () => Promise.reject(new Error('transfer conflict')),
      },
    };
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: rejectingApi, sessionStore: createMemorySessionStore('ray-torres') });
    await user.click(await screen.findByRole('button', { name: 'Open details for Hammer drill unit TL-101' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    await user.click(within(dialog).getByRole('button', { name: 'Transfer tool' }));
    await chooseFieldOption(user, within(dialog).getByRole('combobox', { name: 'Send to' }), /South Shop/);
    const note = within(dialog).getByPlaceholderText('Add context for the record');
    await user.type(note, 'Keep this note');
    await user.click(within(dialog).getByRole('switch', { name: 'Attach a mock photo to this record' }));
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('transfer conflict');
    expect(note).toHaveValue('Keep this note');
    expect(within(dialog).getByRole('switch', { name: 'Attach a mock photo to this record' })).toBeChecked();
  });

  it('preserves pending-handoff evidence drafts when resolution is rejected', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const rejectingApi = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        withdrawRequest: async () => Promise.reject(new Error('withdraw conflict')),
      },
    };
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: rejectingApi, sessionStore: createMemorySessionStore('ray-torres') });
    const card = await screen.findByRole('article', { name: 'Bandsaw pending handoff' });
    await user.click(within(card).getByRole('button', { name: 'Add note/photo' }));
    const note = within(card).getByPlaceholderText('Add context for the record');
    await user.type(note, 'Keep this pending note');
    await user.click(within(card).getByRole('switch', { name: 'Attach a mock photo to this record' }));
    await user.click(within(card).getByRole('button', { name: 'Withdraw request' }));
    expect(await within(card).findByRole('alert')).toHaveTextContent('withdraw conflict');
    expect(note).toHaveValue('Keep this pending note');
    expect(within(card).getByRole('switch', { name: 'Attach a mock photo to this record' })).toBeChecked();
  });

  it('disables a pending detail command and sends it once on a repeated click', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let resolveReport: (result: Awaited<ReturnType<typeof baseApi.custody.reportToolCondition>>) => void = () =>
      undefined;
    let reportCalls = 0;
    const reportPromise = new Promise<Awaited<ReturnType<typeof baseApi.custody.reportToolCondition>>>((resolve) => {
      resolveReport = resolve;
    });
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        reportToolCondition: async () => {
          reportCalls += 1;
          return reportPromise;
        },
      },
    };
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('ray-torres') });
    await user.click(await screen.findByRole('button', { name: 'Open details for Hammer drill unit TL-101' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    await user.click(within(dialog).getByRole('button', { name: 'Report damaged' }));
    await user.type(within(dialog).getByPlaceholderText('Add context for the record'), 'Deferred report');
    await user.click(within(dialog).getByRole('switch', { name: 'Attach a mock photo to this record' }));
    const confirm = within(dialog).getByRole('button', { name: 'Confirm' });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    expect(reportCalls).toBe(1);
    await user.click(confirm);
    expect(reportCalls).toBe(1);
    resolveReport({ toolUnitId: 'TL-101', eventId: 'EV-DEFERRED', status: 'reported' });
    expect(await within(dialog).findByText('Tool reported damaged.')).toBeInTheDocument();
  });

  it('disables a pending handoff resolution and preserves its evidence draft', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let resolveWithdraw: (result: Awaited<ReturnType<typeof baseApi.custody.withdrawRequest>>) => void = () =>
      undefined;
    let withdrawCalls = 0;
    const withdrawPromise = new Promise<Awaited<ReturnType<typeof baseApi.custody.withdrawRequest>>>((resolve) => {
      resolveWithdraw = resolve;
    });
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        withdrawRequest: async () => {
          withdrawCalls += 1;
          return withdrawPromise;
        },
      },
    };
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('ray-torres') });
    const card = await screen.findByRole('article', { name: 'Bandsaw pending handoff' });
    await user.click(within(card).getByRole('button', { name: 'Add note/photo' }));
    const note = within(card).getByPlaceholderText('Add context for the record');
    await user.type(note, 'Deferred handoff');
    await user.click(within(card).getByRole('switch', { name: 'Attach a mock photo to this record' }));
    const withdraw = within(card).getByRole('button', { name: 'Withdraw request' });
    await user.click(withdraw);
    expect(withdraw).toBeDisabled();
    expect(withdrawCalls).toBe(1);
    await user.click(withdraw);
    expect(withdrawCalls).toBe(1);
    expect(note).toHaveValue('Deferred handoff');
    expect(within(card).getByRole('switch', { name: 'Attach a mock photo to this record' })).toBeChecked();
    resolveWithdraw({ toolUnitId: 'TL-108', handoffId: 'HO-1', eventId: 'EV-DEFERRED-2', status: 'withdrawn' });
  });
});
