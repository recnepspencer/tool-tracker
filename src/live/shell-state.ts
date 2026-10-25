import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function useShellNavigation() {
  const location = useLocation();
  const [openPath, setOpenPath] = useState<string | null>(null);
  // Scrolling synchronizes a browser API with navigation; no derived state effect.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return {
    menu: openPath === location.pathname,
    setMenu: (open: boolean) => setOpenPath(open ? location.pathname : null),
  };
}
