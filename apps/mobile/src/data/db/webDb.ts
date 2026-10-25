import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';
import { loadSnapshot, saveSnapshot, Snapshot } from './webSnapshot';

/**
 * Web only: the planner database lives in memory and is copied to IndexedDB (webSnapshot.ts).
 *
 * expo-sqlite's default web storage (OPFS) let the database worker hang on the first write in
 * the iPhone home-screen app; every synchronous call then froze the page for 10 s or more, so
 * taps seemed dead. In memory a synchronous call never waits on storage, and saving the copy is
 * asynchronous, so it never blocks a tap.
 */

const TAB_LOCK = 'weekly-planner-db';
const SAVE_DELAY_MS = 250;
const LEGACY_TIMEOUT_MS = 8000;
/** Rows per read: a synchronous result on web must stay under 1 MB. */
const PAGE_ROWS = 500;

/** Thrown when another tab of this browser already has the planner open. */
export class OtherTabError extends Error {
  constructor() {
    super('OTHER_TAB');
  }
}

/** One tab at a time: two in-memory copies saving over each other would lose changes. */
function holdTabLock(): Promise<boolean> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return Promise.resolve(true);
  return new Promise((resolve) => {
    void locks.request(TAB_LOCK, { ifAvailable: true }, (lock) => {
      resolve(lock != null);
      // Never settles, so the lock is held until the page closes.
      return lock ? new Promise<void>(() => {}) : undefined;
    });
  });
}

type Read = <T>(sql: string) => T[] | Promise<T[]>;

/**
 * Copies schema and rows out of a database. With synchronous reads nothing else can run in
 * between (every await is on an already-settled value), so the copy is consistent.
 */
async function dump(read: Read): Promise<Snapshot> {
  const [pragma] = await read<{ user_version: number }>('PRAGMA user_version');
  const schema = await read<{ type: string; name: string; sql: string }>(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' " +
      "ORDER BY type = 'table' DESC, rowid",
  );
  const rows: Snapshot['rows'] = {};
  for (const { type, name } of schema) {
    if (type !== 'table') continue;
    const table: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += PAGE_ROWS) {
      const page = await read<Record<string, unknown>>(`SELECT * FROM "${name}" LIMIT ${PAGE_ROWS} OFFSET ${offset}`);
      table.push(...page);
      if (page.length < PAGE_ROWS) break;
    }
    rows[name] = table;
  }
  return { version: pragma?.user_version ?? 0, schema, rows };
}

/** Rebuilds a snapshot into an empty database: tables, rows, then indexes. */
function restore(database: SQLiteDatabase, snapshot: Snapshot): void {
  database.withTransactionSync(() => {
    for (const object of snapshot.schema) if (object.type === 'table') database.execSync(object.sql);
    for (const [table, rows] of Object.entries(snapshot.rows)) {
      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        database.runSync(
          `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          columns.map((c) => row[c] as string | number | null),
        );
      }
    }
    for (const object of snapshot.schema) if (object.type !== 'table') database.execSync(object.sql);
    database.execSync(`PRAGMA user_version = ${Math.trunc(snapshot.version)}`);
  });
}

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), LEGACY_TIMEOUT_MS)),
  ]);
}

/** expo-sqlite's OPFS pool files start with a 4 KB header; anything larger holds data. */
const POOL_HEADER_BYTES = 4096;

type DirectoryEntries = { entries(): AsyncIterable<[string, FileSystemHandle]> };

async function holdsData(dir: FileSystemDirectoryHandle, depth: number): Promise<boolean> {
  for await (const [, handle] of (dir as unknown as DirectoryEntries).entries()) {
    if (handle.kind === 'file' && (await (handle as FileSystemFileHandle).getFile()).size > POOL_HEADER_BYTES) return true;
    if (handle.kind === 'directory' && depth > 0 && (await holdsData(handle as FileSystemDirectoryHandle, depth - 1))) return true;
  }
  return false;
}

/**
 * Whether the previous storage (OPFS) holds a planner, checked without opening a database there
 * (opening creates files, and writing there is what hung on iPhone).
 */
async function hasLegacyStorage(): Promise<boolean> {
  try {
    return await holdsData(await navigator.storage.getDirectory(), 2);
  } catch {
    // No OPFS in this browser: nothing to carry over.
    return false;
  }
}

/** Reads the planner from the previous storage (OPFS), once, to carry it over. Reads only. */
async function readLegacyDatabase(name: string): Promise<Snapshot | null> {
  if (!(await hasLegacyStorage())) return null;
  const legacy = await withTimeout(openDatabaseAsync(name), 'Opening saved planner data');
  try {
    const snapshot = await withTimeout(
      dump((sql) => legacy.getAllAsync(sql)),
      'Reading saved planner data',
    );
    return snapshot.schema.length > 0 ? snapshot : null;
  } finally {
    legacy.closeAsync().catch(() => {});
  }
}

/**
 * Opens the in-memory database from the IndexedDB copy, or from the previous storage the first
 * time. `fresh` means nothing is in IndexedDB yet, so the caller saves right away.
 */
export async function openWebDatabase(name: string): Promise<{ database: SQLiteDatabase; fresh: boolean }> {
  if (!(await holdTabLock())) throw new OtherTabError();
  const saved = await loadSnapshot();
  const initial = saved ?? (await readLegacyDatabase(name));
  const database = await openDatabaseAsync(':memory:');
  if (initial) restore(database, initial);
  return { database, fresh: saved == null };
}

type WriteMethod = 'runSync' | 'execSync';

/** Saves the database to IndexedDB shortly after every write, and when the app is hidden or closed. */
export function persistWrites(database: SQLiteDatabase): { saveNow: () => Promise<void> } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saving: Promise<void> = Promise.resolve();

  const saveNow = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    // Copy now (synchronously, so it's consistent); writes to IndexedDB are chained so the last
    // save always holds the latest data.
    const copy = dump((sql) => database.getAllSync(sql));
    saving = saving
      .then(() => copy)
      .then(saveSnapshot)
      .catch((err: unknown) => {
        const message = `Saving the planner failed: ${err instanceof Error ? err.message : String(err)}`;
        console.error(message);
        (globalThis as { __touchDiag?: (msg: string) => void }).__touchDiag?.(message);
      });
    return saving;
  };

  for (const name of ['runSync', 'execSync'] as WriteMethod[]) {
    const original = (database[name] as (...args: unknown[]) => unknown).bind(database);
    (database as unknown as Record<WriteMethod, (...args: unknown[]) => unknown>)[name] = (...args: unknown[]) => {
      const result = original(...args);
      // A transaction finishes within the same task, so the timer only fires after its COMMIT.
      timer ??= setTimeout(() => void saveNow(), SAVE_DELAY_MS);
      return result;
    };
  }

  const flush = () => {
    if (timer) void saveNow();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  return { saveNow };
}
