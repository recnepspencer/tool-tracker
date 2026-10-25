import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from './client';

export function useCommandForm(submit: (data: FormData) => Promise<unknown>, onDone?: () => void) {
  const [state, setState] = useState<{ busy: boolean; error: string; success: boolean; conflict: boolean }>({
    busy: false,
    error: '',
    success: false,
    conflict: false,
  });
  const running = useRef(false);
  const draftCommand = useRef<typeof submit | null>(null);
  const cache = useQueryClient();
  const beginDraft = () => {
    draftCommand.current ??= submit;
  };
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    running.current = true;
    setState({ busy: true, error: '', success: false, conflict: false });
    try {
      // Preserve the revision the user started editing, even if a background read
      // has since supplied a newer command closure to the rendered form.
      await (draftCommand.current ?? submit)(new FormData(event.currentTarget));
      draftCommand.current = null;
      await cache.invalidateQueries({
        predicate: (query) => !['session', 'invitation'].includes(String(query.queryKey[0])),
      });
      onDone?.();
      setState({ busy: false, error: '', success: true, conflict: false });
    } catch (error) {
      setState({
        busy: false,
        error: errorMessage(error),
        success: false,
        conflict: error instanceof ApiError && error.status === 409,
      });
    } finally {
      running.current = false;
    }
  }
  async function reload(form: HTMLFormElement) {
    await cache.invalidateQueries({
      predicate: (query) => !['session', 'invitation'].includes(String(query.queryKey[0])),
    });
    form.reset();
    draftCommand.current = null;
    setState({ busy: false, error: '', success: false, conflict: false });
  }
  return { ...state, beginDraft, run, reload };
}
