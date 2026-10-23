/// <reference types="vite-plugin-pwa/react" />
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const {
    needRefresh: [update, setUpdate],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) window.addEventListener('online', () => void registration.update());
    },
  });
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('beforeinstallprompt', prompt);
    return () => {
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('beforeinstallprompt', prompt);
    };
  }, []);
  return (
    <>
      {!online && (
        <div className="status-bar" role="status">
          You’re offline. Reconnect to load records or save changes.
        </div>
      )}
      {update && (
        <div className="status-bar">
          An update is ready. Finish any unsaved changes first.{' '}
          <button onClick={() => void updateServiceWorker(true)}>Update app</button>
          <button onClick={() => setUpdate(false)}>Later</button>
        </div>
      )}
      {install && (
        <div className="install-bar">
          <button
            onClick={async () => {
              await install.prompt();
              await install.userChoice;
              setInstall(null);
            }}
          >
            Install Nelson Electric
          </button>
          <button aria-label="Dismiss install offer" onClick={() => setInstall(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
