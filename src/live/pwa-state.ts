/// <reference types="vite-plugin-pwa/react" />
import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export function usePwaState() {
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [installError, setInstallError] = useState('');
  const reloadRequested = useRef(false);
  const [activatedUpdate, setActivatedUpdate] = useState(false);
  const {
    needRefresh: [update, setUpdate],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload: () => {
      // Activating a worker is shared; consent to discard a page is per tab.
      if (reloadRequested.current) window.location.reload();
      else setActivatedUpdate(true);
    },
  });
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
    update: update || activatedUpdate,
    installApp,
    dismissInstall: () => setInstall(null),
    dismissInstallError: () => setInstallError(''),
    later: () => {
      reloadRequested.current = false;
      setUpdate(false);
      setActivatedUpdate(false);
    },
    updateApp: async () => {
      if (activatedUpdate) window.location.reload();
      else {
        reloadRequested.current = true;
        await updateServiceWorker(true);
      }
    },
  };
}
