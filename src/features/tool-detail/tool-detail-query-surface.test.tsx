import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { useCustodyMutations } from '../custody/use-custody-mutations';

function DamageHarness() {
  const mutations = useCustodyMutations();
  return (
    <button
      type="button"
      onClick={() =>
        void mutations.reportToolCondition.mutateAsync({
          toolUnitId: 'TL-101',
          actorId: 'ray-torres',
          condition: 'damaged',
        })
      }
    >
      Run damage
    </button>
  );
}

describe('active detail query safety', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/tools';
  });

  afterEach(() => cleanup());

  it('removes cached detail actions when the authoritative refetch errors', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi(createMockDatabase());
    let resolveDamage: (result: Awaited<ReturnType<typeof baseApi.custody.reportToolCondition>>) => void = () =>
      undefined;
    let rejectDetail: (reason?: unknown) => void = () => undefined;
    let damageStarted = false;
    let detailCalls = 0;
    const damagePromise = new Promise<Awaited<ReturnType<typeof baseApi.custody.reportToolCondition>>>((resolve) => {
      resolveDamage = resolve;
    });
    const detailRefetchPromise = new Promise<Awaited<ReturnType<typeof baseApi.tools.getToolDetail>>>(
      (_resolve, reject) => {
        rejectDetail = reject;
      },
    );
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        getToolDetail: async (toolUnitId: string) => {
          detailCalls += 1;
          return damageStarted ? detailRefetchPromise : baseApi.tools.getToolDetail(toolUnitId);
        },
      },
      custody: {
        ...baseApi.custody,
        reportToolCondition: async () => {
          damageStarted = true;
          return damagePromise;
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <DamageHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    await user.click(await screen.findByRole('button', { name: 'Open details for Hammer drill unit TL-101' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    await user.click(screen.getByRole('button', { name: 'Run damage' }));
    const receipt = await baseApi.custody.reportToolCondition({
      toolUnitId: 'TL-101',
      actorId: 'ray-torres',
      condition: 'damaged',
    });
    resolveDamage(receipt);
    await waitFor(() => expect(detailCalls).toBeGreaterThanOrEqual(2));
    rejectDetail(new Error('detail unavailable'));
    expect(await within(dialog).findByText('This tool detail could not be loaded.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Transfer tool' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Report damaged' })).not.toBeInTheDocument();
  });
});
