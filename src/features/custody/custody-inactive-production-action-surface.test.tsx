import { useCallback, useEffect, useState } from 'react';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import type { AuthSession } from '../../domain/auth';
import type { ToolDetailView } from '../../domain/read-models/tools';
import type { ToolHolderView } from '../../domain/read-models/holder';
import { renderApp } from '../../test/render-app';
import { openFieldOptions } from '../../test/choose-field-option';
import { useTransferTargets } from './use-custody-queries';
import { ToolCustodyActions } from '../tool-detail/ToolCustodyActions';
import { useCustodyMutations } from './use-custody-mutations';
import { queryKeys } from '../../api/query-keys';

interface TargetState {
  data?: ToolHolderView[];
  isPending: boolean;
  isFetching: boolean;
  isPaused: boolean;
  isError: boolean;
}

const idleTargetState: TargetState = {
  isPending: true,
  isFetching: false,
  isPaused: false,
  isError: false,
};

async function expectSelectedWarehouse(user: UserEvent) {
  const listbox = await openFieldOptions(user, screen.getByRole('combobox', { name: 'Warehouse' }));
  expect(within(listbox).getByRole('option', { name: 'South Shop Warehouse' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await user.keyboard('{Escape}');
}

function TransferTargetObserver({ onState }: { onState(state: TargetState): void }) {
  const query = useTransferTargets('ray-torres', 'TL-102');
  useEffect(() => {
    onState({
      data: query.data,
      isPending: query.isPending,
      isFetching: query.isFetching,
      isPaused: query.isPaused,
      isError: query.isError,
    });
  }, [onState, query.data, query.isError, query.isFetching, query.isPaused, query.isPending]);
  return null;
}

function RequestMutationHarness() {
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

function ProductionActionPanelHarness({ detail, session }: { detail: ToolDetailView; session: AuthSession }) {
  const mutations = useCustodyMutations();
  const queryClient = useQueryClient();
  const [observerMounted, setObserverMounted] = useState(true);
  const [panelMounted, setPanelMounted] = useState(true);
  const [targetState, setTargetState] = useState<TargetState>(idleTargetState);
  const [target, setTarget] = useState('warehouse:south-shop');
  const onState = useCallback((nextState: TargetState) => setTargetState(nextState), []);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setObserverMounted(false);
          setPanelMounted(false);
        }}
      >
        Unmount production action panel
      </button>
      <button type="button" onClick={() => setObserverMounted(true)}>
        Remount target query
      </button>
      <button type="button" onClick={() => setPanelMounted(true)}>
        Remount production action panel
      </button>
      <button
        type="button"
        onClick={() =>
          void queryClient.invalidateQueries({ queryKey: queryKeys.transferTargetsRoot, refetchType: 'all' })
        }
      >
        Invalidate target query
      </button>
      {observerMounted ? <TransferTargetObserver onState={onState} /> : null}
      {panelMounted ? (
        <ToolCustodyActions
          detail={detail}
          session={session}
          action="transfer"
          target={target}
          note=""
          mockPhoto={false}
          canStartHandoff
          detailRefreshing={false}
          busy={mutations.startTransfer.isPending}
          targets={targetState}
          onAction={() => undefined}
          onTargetChange={setTarget}
          onNoteChange={() => undefined}
          onMockPhotoChange={() => undefined}
          onCloseAction={() => undefined}
          onSubmit={() =>
            void mutations.startTransfer.mutateAsync({
              toolUnitId: detail.tool.id,
              actorId: session.profileId,
              to: { type: 'warehouse', warehouseId: 'south-shop' },
            })
          }
        />
      ) : null}
    </>
  );
}

describe('inactive target query production action boundary', () => {
  beforeEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    cleanup();
  });

  it('remounts the real action panel against a held inactive refetch with its selection intact', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const detail = await baseApi.tools.getToolDetail('TL-102');
    const session = await baseApi.auth.signInAs('ray-torres');
    let requestStarted = false;
    let targetRefetchStarted = false;
    let transferCalls = 0;
    let resolveTargets: (targets: ToolHolderView[]) => void = () => undefined;
    const targetRefetch = new Promise<ToolHolderView[]>((resolve) => {
      resolveTargets = resolve;
    });
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        requestTool: async (input: Parameters<typeof baseApi.custody.requestTool>[0]) => {
          requestStarted = true;
          return baseApi.custody.requestTool(input);
        },
        startTransfer: async (input: Parameters<typeof baseApi.custody.startTransfer>[0]) => {
          transferCalls += 1;
          return baseApi.custody.startTransfer(input);
        },
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => {
          if (!requestStarted) return baseApi.custody.listTransferTargets(input);
          if (!targetRefetchStarted) {
            targetRefetchStarted = true;
            return targetRefetch;
          }
          return baseApi.custody.listTransferTargets(input);
        },
      },
    };
    renderApp(
      <>
        <RequestMutationHarness />
        <ProductionActionPanelHarness detail={detail} session={session} />
      </>,
      { api },
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to South Shop' })).not.toBeDisabled());
    await expectSelectedWarehouse(user);
    await user.click(screen.getByRole('button', { name: 'Unmount production action panel' }));
    await user.click(screen.getByRole('button', { name: 'Run request' }));
    await waitFor(() => expect(requestStarted).toBe(true));
    await waitFor(() => expect(targetRefetchStarted).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Remount target query' }));
    await user.click(screen.getByRole('button', { name: 'Remount production action panel' }));
    expect(await screen.findByText('Loading transfer targets…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to South Shop' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Send to South Shop' }));
    expect(transferCalls).toBe(0);
    resolveTargets(await baseApi.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-102' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to South Shop' })).not.toBeDisabled());
    await expectSelectedWarehouse(user);
    expect(screen.getByRole('button', { name: 'Send to South Shop' })).not.toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Send to South Shop' }));
    await waitFor(() => expect(transferCalls).toBe(1));
  });

  it('keeps the real action panel blocked for a paused inactive target refetch', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const detail = await baseApi.tools.getToolDetail('TL-102');
    const session = await baseApi.auth.signInAs('ray-torres');
    let transferCalls = 0;
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        startTransfer: async (input: Parameters<typeof baseApi.custody.startTransfer>[0]) => {
          transferCalls += 1;
          return baseApi.custody.startTransfer(input);
        },
      },
    };
    renderApp(<ProductionActionPanelHarness detail={detail} session={session} />, { api });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to South Shop' })).not.toBeDisabled());
    await expectSelectedWarehouse(user);
    await user.click(screen.getByRole('button', { name: 'Unmount production action panel' }));
    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Invalidate target query' }));
    await user.click(screen.getByRole('button', { name: 'Remount target query' }));
    await user.click(screen.getByRole('button', { name: 'Remount production action panel' }));
    expect(await screen.findByText('Loading transfer targets…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to South Shop' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Send to South Shop' }));
    expect(transferCalls).toBe(0);
    onlineManager.setOnline(true);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to South Shop' })).not.toBeDisabled());
    await expectSelectedWarehouse(user);
    await user.click(screen.getByRole('button', { name: 'Send to South Shop' }));
    await waitFor(() => expect(transferCalls).toBe(1));
  });

  it('keeps the real action panel blocked for an errored inactive target refetch', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const detail = await baseApi.tools.getToolDetail('TL-102');
    const session = await baseApi.auth.signInAs('ray-torres');
    let targetCalls = 0;
    let transferCalls = 0;
    let shouldReject = false;
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => {
          targetCalls += 1;
          if (shouldReject) throw new Error('targets unavailable');
          return baseApi.custody.listTransferTargets(input);
        },
        startTransfer: async (input: Parameters<typeof baseApi.custody.startTransfer>[0]) => {
          transferCalls += 1;
          return baseApi.custody.startTransfer(input);
        },
      },
    };
    renderApp(<ProductionActionPanelHarness detail={detail} session={session} />, { api });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to South Shop' })).not.toBeDisabled());
    await expectSelectedWarehouse(user);
    await user.click(screen.getByRole('button', { name: 'Unmount production action panel' }));
    shouldReject = true;
    await user.click(screen.getByRole('button', { name: 'Invalidate target query' }));
    await waitFor(() => expect(targetCalls).toBeGreaterThan(1));
    await user.click(screen.getByRole('button', { name: 'Remount target query' }));
    await user.click(screen.getByRole('button', { name: 'Remount production action panel' }));
    expect(await screen.findByText('Transfer targets could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to South Shop' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Send to South Shop' }));
    expect(transferCalls).toBe(0);
    shouldReject = false;
    await user.click(screen.getByRole('button', { name: 'Invalidate target query' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to South Shop' })).not.toBeDisabled());
    await expectSelectedWarehouse(user);
    await user.click(screen.getByRole('button', { name: 'Send to South Shop' }));
    await waitFor(() => expect(transferCalls).toBe(1));
  });
});
