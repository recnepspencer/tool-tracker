/// <reference types="vite-plugin-pwa/react" />
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** An open app checks for a new release this often, besides on every load. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export function usePwaState() {
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [installError, setInstallError] = useState('');
  // The page the tab was showing when a new release took over its service worker.
  const [updatedOn, setUpdatedOn] = useState<string | null>(null);
  useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
    onNeedReload: () => setUpdatedOn(window.location.pathname),
  });
  // Whether anyone has typed, picked or clicked inside a form on this page; switching apps
  // to look something up must not cost them what they had filled in.
  const { pathname } = useLocation();
  const touched = useRef(false);
  useEffect(() => {
    touched.current = false;
  }, [pathname]);
  useEffect(() => {
    const touch = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('form')) touched.current = true;
    };
    const kinds = ['input', 'change', 'click'];
    for (const kind of kinds) document.addEventListener(kind, touch, true);
    return () => {
      for (const kind of kinds) document.removeEventListener(kind, touch, true);
    };
  }, []);
  // Reload into the new release once the page is being left anyway, or while the tab is in
  // the background with no form in progress.
  useEffect(() => {
    if (updatedOn === null) return;
    const safe = () => pathname !== updatedOn || (document.visibilityState === 'hidden' && !touched.current);
    if (safe()) {
      window.location.reload();
      return;
    }
    const hidden = () => safe() && window.location.reload();
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [updatedOn, pathname]);
  // Connection and installation events are external browser state.
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstallError('');
      setInstall(event as InstallPrompt);
    };
    const installed = () => {
      setInstall(null);
      setInstallError('');
    };
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('beforeinstallprompt', prompt);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('beforeinstallprompt', prompt);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  async function installApp() {
    if (!install) return;
    const offer = install;
    setInstall(null);
    try {
      await offer.prompt();
      await offer.userChoice;
    } catch {
      setInstallError('Installation could not open. Try again from your browser menu.');
    }
  }

  return {
    online,
    install,
    installError,
    installApp,
    dismissInstall: () => setInstall(null),
    dismissInstallError: () => setInstallError(''),
  };
}
