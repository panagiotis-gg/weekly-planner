import { newId } from '@planner/shared';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Local SQLite schema: mirrors the server's planner content tables (database-schema.md §4)
 * minus `server_seq`, plus the outbox and key-value tables (§5).
 * Applied in order; PRAGMA user_version records the last one applied.
 * A step is SQL, or a function when it needs to transform data.
 */
export type MigrationStep = string | ((db: SQLiteDatabase) => void);

const syncCols = `
  planner_id TEXT NOT NULL,
  field_clocks TEXT NOT NULL DEFAULT '{}',
  deleted INTEGER NOT NULL DEFAULT 0`;

/** 2: targets (DECISIONS J1–J16) and completion records replacing habit checks (J7). */
function targetsAndCompletions(db: SQLiteDatabase): void {
  db.execSync(`
    ALTER TABLE habit_schedules ADD COLUMN target_type TEXT;
    ALTER TABLE habit_schedules ADD COLUMN per_day INTEGER;
    ALTER TABLE habit_schedules ADD COLUMN days_per_week INTEGER;
    ALTER TABLE habit_schedules ADD COLUMN times_per_week INTEGER;
    ALTER TABLE weekly_todos ADD COLUMN target_type TEXT;
    ALTER TABLE weekly_todos ADD COLUMN per_day INTEGER;
    ALTER TABLE weekly_todos ADD COLUMN days_per_week INTEGER;
    ALTER TABLE weekly_todos ADD COLUMN times_per_week INTEGER;
    ALTER TABLE habits ADD COLUMN hide_when_achieved INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE tasks ADD COLUMN per_day INTEGER;
    ALTER TABLE tasks ADD COLUMN span_days INTEGER;

    CREATE TABLE completions (
      id TEXT PRIMARY KEY NOT NULL, item_type TEXT NOT NULL, item_id TEXT NOT NULL, date TEXT NOT NULL, ${syncCols}
    );
    CREATE INDEX completions_by_item ON completions (planner_id, item_id, date);
  `);

  // Each live tick becomes one completion; it reuses the tick's clock and is queued for sync.
  const ticks = db.getAllSync<{ habit_id: string; date: string; planner_id: string; field_clocks: string }>(
    'SELECT habit_id, date, planner_id, field_clocks FROM habit_checks WHERE checked = 1 AND deleted = 0',
  );
  for (const tick of ticks) {
    const clock = (JSON.parse(tick.field_clocks) as Record<string, string>).checked ?? '0000000000000:0000:migration';
    const fields = { itemType: 'habit', itemId: tick.habit_id, date: tick.date, deleted: false };
    const clocks = { itemType: clock, itemId: clock, date: clock, deleted: clock };
    const id = newId();
    db.runSync(
      "INSERT INTO completions (id, item_type, item_id, date, planner_id, field_clocks) VALUES (?, 'habit', ?, ?, ?, ?)",
      [id, tick.habit_id, tick.date, tick.planner_id, JSON.stringify(clocks)],
    );
    db.runSync(
      "INSERT INTO outbox (entity_type, entity_id, planner_id, fields, clocks, created_at) VALUES ('completion', ?, ?, ?, ?, ?)",
      [id, tick.planner_id, JSON.stringify(fields), JSON.stringify(clocks), new Date().toISOString()],
    );
  }
  db.execSync(`
    DELETE FROM outbox WHERE entity_type = 'habit_check';
    DROP TABLE habit_checks;
  `);
}

export const MIGRATIONS: MigrationStep[] = [
  `
  CREATE TABLE planners (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT,
    week_start_day INTEGER NOT NULL DEFAULT 1,
    day_colors TEXT NOT NULL DEFAULT '{}',
    field_clocks TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE day_entries (
    id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, focus TEXT, note TEXT, ${syncCols}
  );
  CREATE INDEX day_entries_by_date ON day_entries (planner_id, date);

  CREATE TABLE week_notes (
    id TEXT PRIMARY KEY NOT NULL, week_key TEXT NOT NULL, body TEXT, ${syncCols}
  );
  CREATE INDEX week_notes_by_week ON week_notes (planner_id, week_key);

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0, position TEXT NOT NULL, ${syncCols}
  );
  CREATE INDEX tasks_by_date ON tasks (planner_id, date);

  CREATE TABLE weekly_todos (
    id TEXT PRIMARY KEY NOT NULL, week_key TEXT NOT NULL, title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0, position TEXT NOT NULL, ${syncCols}
  );
  CREATE INDEX weekly_todos_by_week ON weekly_todos (planner_id, week_key);

  CREATE TABLE habits (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, position TEXT NOT NULL,
    starts_on TEXT NOT NULL, ends_on TEXT, ${syncCols}
  );
  CREATE TABLE habit_schedules (
    id TEXT PRIMARY KEY NOT NULL, habit_id TEXT NOT NULL, effective_from TEXT NOT NULL,
    weekdays INTEGER NOT NULL, ${syncCols}
  );
  CREATE TABLE habit_checks (
    id TEXT PRIMARY KEY NOT NULL, habit_id TEXT NOT NULL, date TEXT NOT NULL,
    checked INTEGER NOT NULL, ${syncCols}
  );
  CREATE INDEX habit_checks_by_date ON habit_checks (planner_id, date);

  CREATE TABLE events (
    id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, start_date TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0, start_time TEXT, end_time TEXT,
    recurrence_freq TEXT, recurrence_weekdays INTEGER, recurrence_until TEXT, recurrence_count INTEGER,
    ${syncCols}
  );
  CREATE TABLE event_exceptions (
    id TEXT PRIMARY KEY NOT NULL, event_id TEXT NOT NULL, original_date TEXT NOT NULL,
    cancelled INTEGER NOT NULL DEFAULT 0, title TEXT, date TEXT, all_day INTEGER,
    start_time TEXT, end_time TEXT, ${syncCols}
  );
  CREATE TABLE event_reminders (
    id TEXT PRIMARY KEY NOT NULL, event_id TEXT NOT NULL, user_id TEXT NOT NULL,
    offset_minutes INTEGER NOT NULL, ${syncCols}
  );

  CREATE TABLE outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    planner_id TEXT NOT NULL,
    fields TEXT NOT NULL,
    clocks TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE sync_state (planner_id TEXT PRIMARY KEY NOT NULL, cursor INTEGER NOT NULL);
  CREATE TABLE kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `,
  targetsAndCompletions,
  // Reminders on every kind of item (DECISIONS K1–K5): optional times, to-do due days, and one
  // reminders table replacing event_reminders (never used by the app, so nothing to carry over).
  `
  ALTER TABLE tasks ADD COLUMN time TEXT;
  ALTER TABLE habits ADD COLUMN time TEXT;
  ALTER TABLE weekly_todos ADD COLUMN due_date TEXT;
  ALTER TABLE weekly_todos ADD COLUMN due_time TEXT;
  DROP TABLE event_reminders;
  CREATE TABLE reminders (
    id TEXT PRIMARY KEY NOT NULL, item_type TEXT NOT NULL, item_id TEXT NOT NULL, user_id TEXT NOT NULL,
    offset_minutes INTEGER NOT NULL, ${syncCols}
  );
  CREATE INDEX reminders_by_item ON reminders (planner_id, item_id);
  `,
];
