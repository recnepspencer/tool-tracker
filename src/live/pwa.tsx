import { useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { isNetworkFailure } from './client';
import { usePwaState } from './pwa-state';
import { isShowingSaved } from './query-persistence';
import './experience/pwa.css';

/**
 * When records on screen could not be refreshed because of the connection,
 * the time they were last loaded; otherwise null.
 */
function useSavedSince() {
  const cache = useQueryClient().getQueryCache();
  return useSyncExternalStore(
    (notify) => cache.subscribe(notify),
    () => {
      let since: number | null = null;
      for (const query of cache.getAll()) {
        const { data, status, fetchFailureReason, dataUpdatedAt } = query.state;
        const failed = fetchFailureReason !== null && isNetworkFailure(fetchFailureReason);
        if (
          data !== undefined &&
          status === 'success' &&
          (failed || isShowingSaved(query)) &&
          query.getObserversCount() > 0
        )
          since = Math.min(since ?? dataUpdatedAt, dataUpdatedAt);
      }
      return since;
    },
  );
}

export function PwaStatus() {
  const { online, update, install, installError, installApp, updateApp, later, dismissInstall, dismissInstallError } =
    usePwaState();
  const savedSince = useSavedSince();
  const savedAt = savedSince
    ? new Date(savedSince).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })
    : null;
  return (
    <>
      {!online ? (
        <div className="status-bar" role="status">
          You’re offline. {savedAt ? `Showing records saved ${savedAt}.` : 'Reconnect to load records.'} Reconnect
          before saving changes.
        </div>
      ) : (
        savedAt && (
          <div className="status-bar" role="status">
            Weak connection. Showing records saved {savedAt}; they will refresh when the connection improves.
          </div>
        )
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
