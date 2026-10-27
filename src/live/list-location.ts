import { useLocation, useSearchParams } from 'react-router-dom';

// List controls belong to navigation: reload, browser Back, and shared links
// all restore the same view without a second local state authority.
export function useListLocation({ background = false } = {}) {
  const [searchParams, setParams] = useSearchParams();
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const backgroundList =
    background && typeof returnTo === 'string' && /^\/app\/(tools|flagged|checkout)(\?|$)/.test(returnTo);
  const params = backgroundList
    ? new URLSearchParams(returnTo.includes('?') ? returnTo.slice(returnTo.indexOf('?')) : '')
    : searchParams;
  function update(key: string, value: string, resetPage = true) {
    // BrowserRouter commits the URL before React renders the next location.
    // Its search-param callback does not queue rapid patches like setState does.
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    if (resetPage) next.delete('offset');
    setParams(next, { replace: true, state: location.state });
  }
  const raw = Number(params.get('offset') ?? 0);
  const offset = Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
  return { params, update, offset, setOffset: (value: number) => update('offset', String(value), false) };
}
