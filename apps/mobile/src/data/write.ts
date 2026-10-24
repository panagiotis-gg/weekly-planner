import {
  ENTITY_FIELD_SCHEMAS,
  EntityType,
  eventExceptionIssues,
  EventExceptionFields,
  EventFields,
  eventIssues,
  FieldClocks,
  HabitScheduleFields,
  habitScheduleIssues,
  mergeFields,
  WeeklyTodoFields,
  weeklyTodoIssues,
} from '@planner/shared';
import { emitChange } from './changes';
import { nextStamp } from './clock';
import { getDb } from './db/client';
import { decodeRow, encodeValue, ENTITIES, toSnake } from './entities';

export class WriteError extends Error {
  constructor(
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
  }
}

type Row = Record<string, unknown> & { fieldClocks: FieldClocks };

function readRow(entityType: EntityType, id: string): Row | null {
  const raw = getDb().getFirstSync<Record<string, unknown>>(`SELECT * FROM ${ENTITIES[entityType].table} WHERE id = ?`, [
    id,
  ]);
  return raw ? decodeRow<Row>(entityType, raw) : null;
}

function invariantIssues(entityType: EntityType, row: Record<string, unknown>): string[] {
  if (entityType === 'event') return eventIssues(row as EventFields);
  if (entityType === 'event_exception') return eventExceptionIssues(row as EventExceptionFields);
  if (entityType === 'habit_schedule') return habitScheduleIssues(row as HabitScheduleFields);
  if (entityType === 'weekly_todo') return weeklyTodoIssues(row as WeeklyTodoFields);
  if (entityType === 'habit' && row.endsOn != null && String(row.endsOn) < String(row.startsOn)) {
    return ['ENDS_BEFORE_STARTS'];
  }
  return [];
}

/**
 * The single write path for planner content (mobile-app-structure.md §4):
 * validate → stamp a clock per field → per-field merge → upsert → append to outbox,
 * all in one SQLite transaction, then notify live queries.
 * Creating a row requires every writable field.
 */
export function writeFields(
  entityType: EntityType,
  id: string,
  plannerId: string,
  fields: Record<string, unknown>,
): void {
  const schema = ENTITY_FIELD_SCHEMAS[entityType];
  const parsed = schema.partial().safeParse(fields);
  if (!parsed.success) throw new WriteError('Invalid fields', parsed.error.issues.map((i) => i.message));

  const db = getDb();
  const { table, columns } = ENTITIES[entityType];

  db.withTransactionSync(() => {
    const current = readRow(entityType, id);
    const clocks: FieldClocks = {};
    for (const field of Object.keys(fields)) clocks[field] = nextStamp();

    const merged = mergeFields(
      current ? { row: current as Record<string, unknown>, clocks: current.fieldClocks } : null,
      fields,
      clocks,
    );

    // A complete row must satisfy the full schema (creation) and the cross-field invariants.
    const full: Record<string, unknown> = {};
    for (const field of Object.keys(columns)) full[field] = merged.row[field];
    if (!current) {
      const complete = schema.safeParse(full);
      if (!complete.success) throw new WriteError('Incomplete row', complete.error.issues.map((i) => i.message));
    }
    const issues = invariantIssues(entityType, full);
    if (issues.length > 0) throw new WriteError('Invalid row', issues);

    const fieldNames = Object.keys(columns);
    if (entityType === 'planner') {
      // Planner rows are created by the app shell; sync only updates their settings.
      const sets = fieldNames.map((f) => `${toSnake(f)} = ?`).join(', ');
      db.runSync(`UPDATE planners SET ${sets}, field_clocks = ? WHERE id = ?`, [
        ...fieldNames.map((f) => encodeValue(columns[f], merged.row[f])),
        JSON.stringify(merged.clocks),
        id,
      ]);
    } else {
      const cols = ['id', 'planner_id', 'field_clocks', ...fieldNames.map(toSnake)];
      const values = [
        id,
        plannerId,
        JSON.stringify(merged.clocks),
        ...fieldNames.map((f) => encodeValue(columns[f], merged.row[f])),
      ];
      const updates = cols.slice(2).map((c) => `${c} = excluded.${c}`).join(', ');
      db.runSync(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        values,
      );
    }

    // Outbox entry for the sync engine (not built yet): only the fields this device wrote.
    db.runSync(
      'INSERT INTO outbox (entity_type, entity_id, planner_id, fields, clocks, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [entityType, id, plannerId, JSON.stringify(fields), JSON.stringify(clocks), new Date().toISOString()],
    );
  });

  emitChange();
}

/** Typed read helper: live rows of a table for a planner, optionally filtered. */
export function selectRows<T>(
  entityType: EntityType,
  plannerId: string,
  where = '',
  params: (string | number)[] = [],
  orderBy = '',
): T[] {
  const { table } = ENTITIES[entityType];
  const sql = `SELECT * FROM ${table} WHERE planner_id = ? AND deleted = 0 ${where ? `AND ${where}` : ''} ${
    orderBy ? `ORDER BY ${orderBy}` : ''
  }`;
  return getDb()
    .getAllSync<Record<string, unknown>>(sql, [plannerId, ...params])
    .map((r) => decodeRow<T>(entityType, r));
}
