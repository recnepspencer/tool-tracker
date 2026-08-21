import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { SharedDefinitionHarness } from './test-support/shared-definition-harness';
import { ToolDecisionProjectionHarness } from './test-support/tool-decision-projection-harness';

describe('tool decision invalidation', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/operations/flagged';
  });

  it('refetches inactive tool, catalog, activity, inventory, and admin summary roots after restore', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-20T09:00:00-06:00' });
    const baseApi = createMockApi(database);
    const calls = { details: 0, targets: 0 };
    let holdInactiveDetail = false;
    let releaseInactiveDetail: (() => void) | undefined;
    let holdInactiveTargets = false;
    let releaseInactiveTargets: (() => void) | undefined;
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        getToolDetail: async (toolUnitId: string) => {
          calls.details += 1;
          if (toolUnitId === 'TL-111' && holdInactiveDetail) {
            holdInactiveDetail = false;
            return new Promise<Awaited<ReturnType<typeof baseApi.tools.getToolDetail>>>((resolve) => {
              releaseInactiveDetail = () => resolve(baseApi.tools.getToolDetail(toolUnitId));
            });
          }
          return baseApi.tools.getToolDetail(toolUnitId);
        },
      },
      custody: {
        ...baseApi.custody,
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => {
          calls.targets += 1;
          if (input.toolUnitId === 'TL-111' && holdInactiveTargets) {
            holdInactiveTargets = false;
            return new Promise<Awaited<ReturnType<typeof baseApi.custody.listTransferTargets>>>((resolve) => {
              releaseInactiveTargets = () => resolve(baseApi.custody.listTransferTargets(input));
            });
          }
          return baseApi.custody.listTransferTargets(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <ToolDecisionProjectionHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByTestId('decision-probe-status')).toHaveTextContent('lost');
    expect(screen.getByTestId('decision-probe-flagged')).toHaveTextContent('2');
    await user.click(screen.getByRole('button', { name: 'Disable decision probes' }));
    const detailsBeforeRestore = calls.details;
    holdInactiveDetail = true;
    holdInactiveTargets = true;
    await user.click(screen.getByRole('button', { name: 'Restore decision probe' }));
    await waitFor(() => expect(screen.queryByText('Cable cutter')).not.toBeInTheDocument());
    await waitFor(() => expect(releaseInactiveDetail).toBeDefined());
    await waitFor(() => expect(releaseInactiveTargets).toBeDefined());
    expect(calls.details).toBeGreaterThan(detailsBeforeRestore);
    // The inactive detail refetch is held; the command promise must remain pending.
    expect(screen.getByTestId('decision-probe-restore-status')).toHaveTextContent('pending');
    releaseInactiveDetail?.();
    releaseInactiveTargets?.();
    await waitFor(() => expect(screen.getByTestId('decision-probe-restore-status')).toHaveTextContent('settled'));
    await user.click(screen.getByRole('button', { name: 'Enable decision probes' }));
    await waitFor(() => expect(screen.getByTestId('decision-probe-status')).toHaveTextContent('in-stock'));
    expect(screen.getByTestId('decision-probe-catalog-lost')).toHaveTextContent('0');
    expect(screen.getByTestId('decision-probe-inventory-condition')).toHaveTextContent('serviceable');
    expect(screen.getByTestId('decision-probe-flagged')).toHaveTextContent('1');
    expect(screen.getByTestId('decision-probe-event')).toHaveTextContent('true');
    expect(screen.getByTestId('decision-probe-detail-condition')).toHaveTextContent('serviceable');
    expect(calls.details).toBeGreaterThan(1);
    expect(calls.targets).toBeGreaterThan(1);
  });

  it('refetches transfer targets and every cached detail that shares an edited definition', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    database.update((state) => {
      const sibling = state.units.find((unit) => unit.id === 'TL-102');
      if (!sibling) throw new Error('Seed sibling is missing');
      sibling.definitionId = 'def-hammer-drill';
      return state;
    });
    const baseApi = createMockApi(database);
    const calls = { details: 0, targets: 0 };
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        getToolDetail: async (toolUnitId: string) => {
          calls.details += 1;
          return baseApi.tools.getToolDetail(toolUnitId);
        },
      },
      custody: {
        ...baseApi.custody,
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => {
          calls.targets += 1;
          return baseApi.custody.listTransferTargets(input);
        },
      },
    };
    renderApp(<SharedDefinitionHarness />, {
      api,
      sessionStore: createMemorySessionStore('sam-ochoa'),
    });
    expect(await screen.findByTestId('shared-definition-first')).toHaveTextContent('Hammer drill');
    expect(screen.getByTestId('shared-definition-sibling')).toHaveTextContent('Hammer drill');
    const before = { ...calls };
    await user.click(screen.getByRole('button', { name: 'Rename shared definition' }));
    await waitFor(() => {
      expect(screen.getByTestId('shared-definition-first')).toHaveTextContent('Hammer drill — revised');
      expect(screen.getByTestId('shared-definition-sibling')).toHaveTextContent('Hammer drill — revised');
    });
    expect(calls.details).toBeGreaterThan(before.details);
    expect(calls.targets).toBeGreaterThan(before.targets);
  });
});
