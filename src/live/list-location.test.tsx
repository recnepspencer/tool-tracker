import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { useListLocation } from './list-location';

it('composes rapid filter patches before React renders, preserving other filters and resetting paging', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.history.replaceState(null, '', '/app/activity?warehouse=MAIN&offset=30');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  function Filters() {
    const { update } = useListLocation();
    return (
      <button
        onClick={() => {
          update('kind', 'request');
          update('search', 'UNIT-001');
        }}
      >
        Apply filters
      </button>
    );
  }
  try {
    await act(async () =>
      root.render(
        <BrowserRouter>
          <Filters />
        </BrowserRouter>,
      ),
    );
    await act(async () => container.querySelector('button')!.click());
    const url = new URL(window.location.href);
    expect(url.pathname).toBe('/app/activity');
    expect(Object.fromEntries(url.searchParams)).toEqual({ warehouse: 'MAIN', kind: 'request', search: 'UNIT-001' });
  } finally {
    await act(async () => root.unmount());
    container.remove();
    window.history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
  }
});
