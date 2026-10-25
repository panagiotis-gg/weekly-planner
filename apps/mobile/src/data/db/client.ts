import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { MIGRATIONS } from './migrations';

const DATABASE_NAME = 'planner.db';

let db: SQLiteDatabase | null = null;
let opening: Promise<SQLiteDatabase> | null = null;

function migrate(database: SQLiteDatabase): void {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    const step = MIGRATIONS[version]!;
    database.withTransactionSync(() => {
      if (typeof step === 'string') database.execSync(step);
      else step(database);
      database.execSync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

const SLOW_CALL_MS = 200;
type SyncMethod = 'getFirstSync' | 'getAllSync' | 'runSync' | 'execSync';

/**
 * Web only: on web every synchronous call blocks the page until the SQLite worker answers, so a
 * slow one freezes taps. Reports slow calls to the touch diagnostics log (public/index.html).
 */
function reportSlowCalls(database: SQLiteDatabase): void {
  const report = (globalThis as { __touchDiag?: (msg: string) => void }).__touchDiag;
  if (!report) return;
  for (const name of ['getFirstSync', 'getAllSync', 'runSync', 'execSync'] as SyncMethod[]) {
    const original = (database[name] as (...args: unknown[]) => unknown).bind(database);
    (database as unknown as Record<SyncMethod, (...args: unknown[]) => unknown>)[name] = (...args: unknown[]) => {
      const started = performance.now();
      try {
        return original(...args);
      } finally {
        const ms = performance.now() - started;
        if (ms > SLOW_CALL_MS) report(`DB slow ${Math.round(ms)}ms ${name} ${String(args[0]).replace(/\s+/g, ' ').slice(0, 50)}`);
      }
    };
  }
}

/**
 * Opens the local replica and brings its schema up to date. Called once at start-up.
 * Opening is asynchronous because on web the SQLite worker and its wasm must finish loading
 * first; after that the synchronous API is safe on every platform.
 */
export function initDb(): Promise<SQLiteDatabase> {
  opening ??= (async () => {
    const database = await openDatabaseAsync(DATABASE_NAME);
    await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    migrate(database);
    if (Platform.OS === 'web') reportSlowCalls(database);
    db = database;
    return database;
  })();
  return opening;
}

export function getDb(): SQLiteDatabase {
  if (!db) throw new Error('Database not initialised: call initDb() first');
  return db;
}

// ---- key-value store (node id, HLC state, preferences) ----

export function kvGet(key: string): string | null {
  return getDb().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key])?.value ?? null;
}

export function kvSet(key: string, value: string): void {
  getDb().runSync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
