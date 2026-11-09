import { usePwaState } from './pwa-state';
import './experience/pwa.css';

export function PwaStatus() {
  const { online, install, installError, installApp, dismissInstall, dismissInstallError } = usePwaState();
  return (
    <>
      {!online && (
        <div className="status-bar" role="status">
          You’re offline. Reconnect to load records or save changes.
        </div>
      )}
      {install && (
        <div className="install-bar">
          <button onClick={() => void installApp()}>Install Tool Tracker</button>
          <button aria-label="Dismiss install offer" onClick={dismissInstall}>
            ×
          </button>
        </div>
      )}
      {installError && (
        <div className="install-bar" role="alert">
          <span>{installError}</span>
          <button aria-label="Dismiss installation message" onClick={dismissInstallError}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
