import { useSearchParams } from 'react-router-dom';

// List controls belong to navigation: reload, browser Back, and shared links
// all restore the same view without a second local state authority.
export function useListLocation() {
  const [params, setParams] = useSearchParams();
  function update(key: string, value: string, resetPage = true) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        if (resetPage) next.delete('offset');
        return next;
      },
      { replace: true },
    );
  }
  const raw = Number(params.get('offset') ?? 0);
  const offset = Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
  return { params, update, offset, setOffset: (value: number) => update('offset', String(value), false) };
}
