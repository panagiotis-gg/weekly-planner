/**
 * Web only: a copy of the whole planner database kept in IndexedDB.
 *
 * On web the database runs in memory and this copy is what survives a reload (see webDb.ts):
 * writing SQLite's file storage directly (OPFS) hung the database worker in the iPhone home-screen
 * app, freezing every tap. IndexedDB is asynchronous, so saving never blocks the page.
 * The copy is plain data (schema SQL and rows), not SQLite's binary file format.
 */

export type Snapshot = {
  /** PRAGMA user_version, so later migrations still run after a restore. */
  version: number;
  /** CREATE statements from sqlite_master, tables first. */
  schema: { type: string; name: string; sql: string }[];
  rows: Record<string, Record<string, unknown>[]>;
};

const DB_NAME = 'weekly-planner';
const STORE = 'snapshots';
const KEY = 'planner';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (idb) =>
      new Promise<T>((resolve, reject) => {
        const tx = idb.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => {
          idb.close();
          resolve(request.result);
        };
        tx.onerror = tx.onabort = () => {
          idb.close();
          reject(tx.error ?? request.error);
        };
      }),
  );
}

export async function loadSnapshot(): Promise<Snapshot | null> {
  const value = await run<unknown>('readonly', (store) => store.get(KEY));
  return value && typeof value === 'object' && 'schema' in value ? (value as Snapshot) : null;
}

export function saveSnapshot(snapshot: Snapshot): Promise<void> {
  return run('readwrite', (store) => store.put(snapshot, KEY)).then(() => undefined);
}
