import type { QueryClient, QueryKey, QueryState } from '@tanstack/react-query';

// Any query in the cache, whatever its data and error types.
type AnyQuery = {
  queryKey: QueryKey;
  queryHash: string;
  state: { data: unknown };
  setState(state: Partial<QueryState<unknown, unknown>>): void;
};

/**
 * Field crews open the app where signal comes and goes. The last records each
 * person loaded are kept in IndexedDB, but they are only a fallback: every
 * screen still asks the server first. Saved records appear when that request
 * fails or is still waiting after a short grace period, so a good connection
 * never shows outdated records while a weak one is not left on a spinner.
 * Signing out or losing the session removes them from the device.
 */
const DATABASE = 'tool-tracker-cache';
const STORE = 'queries';
// Saved records older than this are discarded rather than shown.
const SAVED_FOR = 3 * 24 * 60 * 60 * 1000;
// How long a screen waits for the server before showing saved records.
const GRACE = 1_500;

// One entry per query, written as soon as its answer arrives: a reload a moment
// later aborts unfinished storage work, so nothing waits to be written in bulk.
type Entry = { key: QueryKey; data: unknown; updatedAt: number; revision: string };

let database: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB is unavailable.'));
  }).catch((error: unknown) => {
    database = null;
    throw error;
  });
  return database;
}

async function store(mode: IDBTransactionMode) {
  return (await open()).transaction(STORE, mode).objectStore(STORE);
}

let entries: Record<string, Entry> = {};
// Signing out starts a new generation so a slow read cannot bring records back.
let generation = 0;
let loaded: Promise<void> | null = null;
const showingSaved = new Set<string>();

const usable = (entry: Entry | undefined): entry is Entry =>
  // Records saved by an older release may not match the current API.
  entry?.revision === __API_REVISION__ && entry.updatedAt > Date.now() - SAVED_FOR;

function load() {
  const started = generation;
  loaded ??= store('readwrite')
    .then(
      (saved) =>
        new Promise<void>((resolve, reject) => {
          const cursor = saved.openCursor();
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return resolve();
            const hash = String(current.key);
            const entry = current.value as Entry | undefined;
            if (!usable(entry)) current.delete();
            else if (started === generation && !(hash in entries)) entries[hash] = entry;
            current.continue();
          };
          cursor.onerror = () => reject(cursor.error ?? new Error('IndexedDB read failed.'));
        }),
    )
    // Storage is a convenience: private windows and full disks still work online.
    .catch(() => undefined);
  return loaded;
}

function save(hash: string, entry: Entry) {
  entries[hash] = entry;
  void store('readwrite')
    .then((saved) => saved.put(entry, hash))
    .catch(() => undefined);
}

const saves = (query: AnyQuery) => query.queryKey[0] !== 'invitation';

/** Show this query's saved records while the server cannot answer it. */
export async function showSavedRecords(query: AnyQuery) {
  await load();
  const entry = entries[query.queryHash];
  if (!usable(entry) || query.state.data !== undefined || !saves(query)) return;
  showingSaved.add(query.queryHash);
  // Marked stale, so they are replaced on the next mount, focus or reconnect.
  query.setState({
    data: entry.data,
    dataUpdatedAt: entry.updatedAt,
    status: 'success',
    error: null,
    isInvalidated: true,
  });
}

/** Whether a query on screen holds saved records rather than a fresh answer. */
export const isShowingSaved = (query: AnyQuery) => showingSaved.has(query.queryHash);

/** Save every fresh answer, and fall back to saved records for slow first loads. */
export function keepSavedRecords(client: QueryClient) {
  void load();
  const waiting = new Map<string, ReturnType<typeof setTimeout>>();
  return client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || !saves(event.query)) return;
    const { query, action } = event;
    const hash = query.queryHash;
    if (action.type === 'success') {
      clearTimeout(waiting.get(hash));
      waiting.delete(hash);
      showingSaved.delete(hash);
      save(hash, {
        key: query.queryKey,
        data: query.state.data,
        updatedAt: query.state.dataUpdatedAt,
        revision: __API_REVISION__,
      });
    } else if (action.type === 'fetch' && query.state.data === undefined && !waiting.has(hash)) {
      waiting.set(
        hash,
        setTimeout(() => {
          waiting.delete(hash);
          if (query.state.fetchStatus === 'fetching') void showSavedRecords(query);
        }, GRACE),
      );
    }
  });
}

/** Remove saved company records from this device. */
export async function forgetSavedRecords() {
  generation += 1;
  entries = {};
  showingSaved.clear();
  loaded = Promise.resolve();
  try {
    (await store('readwrite')).clear();
  } catch {
    /* Nothing was stored. */
  }
}
