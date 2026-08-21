import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import type { ReportConditionInput, StartTransferInput } from '../../api/contracts/custody-api';
import { AppRoutes } from '../../app/app-routes';
import { queryKeys } from '../../api/query-keys';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { chooseFieldOption } from '../../test/choose-field-option';
import { useCustodyMutations } from './use-custody-mutations';

function MutationHarness() {
  const mutations = useCustodyMutations();
  const queryClient = useQueryClient();
  const [pendingFetchStatus, setPendingFetchStatus] = useState('unknown');
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void mutations.startTransfer.mutateAsync({
            toolUnitId: 'TL-101',
            actorId: 'ray-torres',
            to: { type: 'warehouse', warehouseId: 'south-shop' },
          })
        }
      >
        Run transfer
      </button>
      <button
        type="button"
        onClick={() => void mutations.requestTool.mutateAsync({ toolUnitId: 'TL-105', actorId: 'ray-torres' })}
      >
        Run request
      </button>
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
      <button
        type="button"
        onClick={() =>
          void queryClient.invalidateQueries({ queryKey: queryKeys.transferTargetsRoot, refetchType: 'all' })
        }
      >
        Invalidate transfer targets
      </button>
      <button
        type="button"
        onClick={() =>
          setPendingFetchStatus(
            queryClient.getQueryState(queryKeys.pendingHandoffs('ray-torres'))?.fetchStatus ?? 'missing',
          )
        }
      >
        Read pending query status
      </button>
      <output aria-label="Pending query status">{pendingFetchStatus}</output>
    </div>
  );
}

describe('inactive TanStack query safety', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/tools';
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('refetches an inactive target cache and disables a selected confirmation while fetching', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    let resolveTransfer: () => void = () => undefined;
    let resolveTargets: (targets: Awaited<ReturnType<typeof baseApi.custody.listTransferTargets>>) => void = () =>
      undefined;
    let targetCalls = 0;
    let transferStarted = false;
    let transferCommandCalls = 0;
    let targetRefetchStarted = false;
    const targetRefetchPromise = new Promise<Awaited<ReturnType<typeof baseApi.custody.listTransferTargets>>>(
      (resolve) => {
        resolveTargets = resolve;
      },
    );
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        startTransfer: async (input: StartTransferInput) => {
          transferCommandCalls += 1;
          transferStarted = true;
          const receipt = await baseApi.custody.startTransfer(input);
          return new Promise<Awaited<ReturnType<typeof baseApi.custody.startTransfer>>>((resolve) => {
            resolveTransfer = () => resolve(receipt);
          });
        },
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => {
          targetCalls += 1;
          if (!transferStarted || input.toolUnitId !== 'TL-102') return baseApi.custody.listTransferTargets(input);
          if (!targetRefetchStarted) {
            targetRefetchStarted = true;
            return targetRefetchPromise;
          }
          return baseApi.custody.listTransferTargets(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <MutationHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    await user.click(await screen.findByRole('button', { name: 'Open details for Fluke 87V multimeter unit TL-102' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    await user.click(within(dialog).getByRole('button', { name: 'Transfer tool' }));
    await chooseFieldOption(user, within(dialog).getByRole('combobox', { name: 'Send to' }), /South Shop/);
    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Invalidate transfer targets' }));
    expect(await within(dialog).findByText('Loading transfer targets…')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeDisabled();
    onlineManager.setOnline(true);
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Send to' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Run transfer' }));
    await waitFor(() => expect(transferStarted).toBe(true));
    expect(database.read().handoffs).toEqual(
      expect.arrayContaining([expect.objectContaining({ toolUnitId: 'TL-101' })]),
    );
    resolveTransfer();
    await waitFor(() => expect(targetCalls).toBeGreaterThanOrEqual(2));
    expect(await within(dialog).findByText('Loading transfer targets…')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(transferCommandCalls).toBe(1);
    resolveTargets(await baseApi.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-102' }));
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Send to' })).toBeInTheDocument());
    expect(within(dialog).getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
  });

  it('fails closed while an active detail refetch is unresolved', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    let resolveDamage: () => void = () => undefined;
    let resolveDetail: (detail: Awaited<ReturnType<typeof baseApi.tools.getToolDetail>>) => void = () => undefined;
    let damageStarted = false;
    let detailCalls = 0;
    const detailRefetchPromise = new Promise<Awaited<ReturnType<typeof baseApi.tools.getToolDetail>>>((resolve) => {
      resolveDetail = resolve;
    });
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
        reportToolCondition: async (input: ReportConditionInput) => {
          damageStarted = true;
          const receipt = await baseApi.custody.reportToolCondition(input);
          return new Promise<Awaited<ReturnType<typeof baseApi.custody.reportToolCondition>>>((resolve) => {
            resolveDamage = () => resolve(receipt);
          });
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <MutationHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    await user.click(await screen.findByRole('button', { name: 'Open details for Hammer drill unit TL-101' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    await user.click(screen.getByRole('button', { name: 'Run damage' }));
    await waitFor(() => expect(damageStarted).toBe(true));
    expect(database.read().conditionReports).toEqual(
      expect.arrayContaining([expect.objectContaining({ toolUnitId: 'TL-101' })]),
    );
    resolveDamage();
    await waitFor(() => expect(detailCalls).toBeGreaterThanOrEqual(2));
    expect(within(dialog).queryByRole('button', { name: 'Transfer tool' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Report damaged' })).not.toBeInTheDocument();
    resolveDetail(await baseApi.tools.getToolDetail('TL-101'));
    expect(await within(dialog).findAllByText('Damaged')).not.toHaveLength(0);
  });
});
