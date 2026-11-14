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
  // Resolves true once the command succeeded and the cache refresh finished.
  async function run(command: () => Promise<unknown>, onDone?: () => void): Promise<boolean> {
    if (running.current) return false;
    running.current = true;
    setState({ busy: true, error: '' });
    try {
      await command();
      onDone?.();
      await cache.invalidateQueries({
        predicate: (query) => !['session', 'invitation'].includes(String(query.queryKey[0])),
      });
      setState({ busy: false, error: '' });
      return true;
    } catch (error) {
      setState({ busy: false, error: errorMessage(error) });
      return false;
    } finally {
      running.current = false;
    }
  }
  // Reset clears a stale error only: a command still refreshing the cache stays busy,
  // so its buttons never re-enable while `run` would ignore their clicks.
  return { ...state, run, reset: () => setState((current) => ({ ...current, error: '' })) };
}
export type Command = ReturnType<typeof useCommand>;
