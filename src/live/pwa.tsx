import { usePwaState } from './pwa-state';

export function PwaStatus() {
  const { online, update, install, installError, installApp, updateApp, later, dismissInstall, dismissInstallError } =
    usePwaState();
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
          <button onClick={() => void updateApp()}>Update app</button>
          <button onClick={later}>Later</button>
        </div>
      )}
      {install && (
        <div className="install-bar">
          <button onClick={() => void installApp()}>Install Nelson Electric</button>
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
