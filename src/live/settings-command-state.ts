import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { errorMessage } from './client';

/**
 * One-click admin commands (archive, remove, revoke, toggle). Mirrors the
 * cache refresh of `useCommandForm` so a button behaves like a saved form.
 */
export function useCommand() {
  const [state, setState] = useState({ busy: false, error: '' });
  const running = useRef(false);
  const cache = useQueryClient();
  async function run(command: () => Promise<unknown>, onDone?: () => void) {
    if (running.current) return;
    running.current = true;
    setState({ busy: true, error: '' });
    try {
      await command();
      onDone?.();
      await cache.invalidateQueries({
        predicate: (query) => !['session', 'invitation'].includes(String(query.queryKey[0])),
      });
      setState({ busy: false, error: '' });
    } catch (error) {
      setState({ busy: false, error: errorMessage(error) });
    } finally {
      running.current = false;
    }
  }
  // Reset clears a stale error only: a command still refreshing the cache stays busy,
  // so its buttons never re-enable while `run` would ignore their clicks.
  return { ...state, run, reset: () => setState((current) => ({ ...current, error: '' })) };
}
export type Command = ReturnType<typeof useCommand>;
