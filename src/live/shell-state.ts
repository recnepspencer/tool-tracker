import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useModalFocusTrap } from './experience/use-modal-focus-trap';
import { useRegistrationPolicy } from './registration-policy';

export function useShellNavigation() {
  const { canRegister } = useRegistrationPolicy();
  const location = useLocation();
  const navigate = useNavigate();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [accountPath, setAccountPath] = useState<string | null>(null);
  const navigationRef = useRef<HTMLElement>(null);
  useModalFocusTrap(openPath === location.pathname, () => setOpenPath(null), navigationRef);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('nelson.appearance') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  // Scrolling synchronizes a browser API with navigation; no derived state effect.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return {
    canRegister,
    navigateHome: () => navigate('/app'),
    menu: openPath === location.pathname,
    navigationRef,
    setMenu: (open: boolean) => setOpenPath(open ? location.pathname : null),
    accountOpen: accountPath === location.pathname,
    setAccountOpen: (open: boolean) => setAccountPath(open ? location.pathname : null),
    theme,
    toggleTheme: () => {
      const next = theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
      try {
        localStorage.setItem('nelson.appearance', next);
      } catch {
        /* Appearance storage is optional. */
      }
    },
  };
}
