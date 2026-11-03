import { useLocation, useNavigate } from 'react-router-dom';

/** Closes a route-driven tool sheet back to the list it was opened from. */
export function useSheetNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const root = location.pathname.startsWith('/app/mine')
    ? '/app/mine'
    : location.pathname.startsWith('/app/checkout')
      ? '/app/checkout'
      : location.pathname.startsWith('/app/flagged')
        ? '/app/flagged'
        : '/app/tools';
  const params = new URLSearchParams(location.search);
  params.delete('action');
  const returnTo =
    typeof location.state?.returnTo === 'string' && location.state.returnTo.startsWith('/app/')
      ? location.state.returnTo
      : root + (params.size ? `?${params}` : '');
  return {
    root,
    close: () => navigate(returnTo, { replace: true }),
  };
}
