import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function RouteScrollRestoration() {
  const location = useLocation();

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.documentElement.scrollLeft = 0;
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
  }, [location.pathname]);

  return null;
}
