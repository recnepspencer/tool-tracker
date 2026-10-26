import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { errorMessage, isStaleRecord } from './client';

export function useCommandForm(submit: (data: FormData) => Promise<unknown>, onDone?: (form: HTMLFormElement) => void) {
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
    const form = event.currentTarget;
    running.current = true;
    setState({ busy: true, error: '', success: false, conflict: false });
    try {
      // Preserve the revision the user started editing, even if a background read
      // has since supplied a newer command closure to the rendered form.
      await (draftCommand.current ?? submit)(new FormData(form));
      draftCommand.current = null;
      // Complete this save before background reads can remove the edited row.
      // A delayed close must never overwrite the user's next navigation.
      if (form.isConnected) onDone?.(form);
      await cache.invalidateQueries({
        predicate: (query) => !['session', 'invitation'].includes(String(query.queryKey[0])),
      });
      setState({ busy: false, error: '', success: true, conflict: false });
    } catch (error) {
      setState({
        busy: false,
        error: errorMessage(error),
        success: false,
        conflict: isStaleRecord(error),
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
