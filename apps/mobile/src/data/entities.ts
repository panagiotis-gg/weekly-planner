import type { EntityType } from '@planner/shared';

type ColumnType = 'text' | 'int' | 'bool' | 'json';

interface EntityMeta {
  table: string;
  /** Writable fields (camelCase) → storage type. `id` / `plannerId` are handled separately. */
  columns: Record<string, ColumnType>;
}

const targetColumns: Record<string, ColumnType> = { targetType: 'text', perDay: 'int', daysPerWeek: 'int', timesPerWeek: 'int' };

/** How each synced entity is stored locally (columns are snake_case versions of the field names). */
export const ENTITIES: Record<EntityType, EntityMeta> = {
  planner: { table: 'planners', columns: { name: 'text', weekStartDay: 'int', dayColors: 'json' } },
  day_entry: { table: 'day_entries', columns: { date: 'text', focus: 'text', note: 'text', deleted: 'bool' } },
  week_note: { table: 'week_notes', columns: { weekKey: 'text', body: 'text', deleted: 'bool' } },
  task: {
    table: 'tasks',
    columns: { date: 'text', title: 'text', done: 'bool', position: 'text', perDay: 'int', spanDays: 'int', deleted: 'bool' },
  },
  weekly_todo: {
    table: 'weekly_todos',
    columns: { weekKey: 'text', title: 'text', done: 'bool', position: 'text', ...targetColumns, deleted: 'bool' },
  },
  habit: {
    table: 'habits',
    columns: { name: 'text', position: 'text', startsOn: 'text', endsOn: 'text', hideWhenAchieved: 'bool', deleted: 'bool' },
  },
  habit_schedule: {
    table: 'habit_schedules',
    columns: { habitId: 'text', effectiveFrom: 'text', weekdays: 'int', ...targetColumns, deleted: 'bool' },
  },
  completion: {
    table: 'completions',
    columns: { itemType: 'text', itemId: 'text', date: 'text', deleted: 'bool' },
  },
  event: {
    table: 'events',
    columns: {
      title: 'text',
      startDate: 'text',
      allDay: 'bool',
      startTime: 'text',
      endTime: 'text',
      recurrenceFreq: 'text',
      recurrenceWeekdays: 'int',
      recurrenceUntil: 'text',
      recurrenceCount: 'int',
      deleted: 'bool',
    },
  },
  event_exception: {
    table: 'event_exceptions',
    columns: {
      eventId: 'text',
      originalDate: 'text',
      cancelled: 'bool',
      title: 'text',
      date: 'text',
      allDay: 'bool',
      startTime: 'text',
      endTime: 'text',
      deleted: 'bool',
    },
  },
  event_reminder: {
    table: 'event_reminders',
    columns: { eventId: 'text', userId: 'text', offsetMinutes: 'int', deleted: 'bool' },
  },
};

export const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function encodeValue(type: ColumnType | undefined, value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (type === 'bool') return value ? 1 : 0;
  if (type === 'json') return JSON.stringify(value);
  return value as string | number;
}

/** SQLite row (snake_case, 0/1 booleans, JSON text) → camelCase object with typed values. */
export function decodeRow<T>(entityType: EntityType, row: Record<string, unknown>): T {
  const { columns } = ENTITIES[entityType];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const field = toCamel(key);
    const type = columns[field];
    if (field === 'fieldClocks') out[field] = JSON.parse(String(value));
    else if (type === 'bool') out[field] = value === null ? null : value === 1;
    else if (type === 'json') out[field] = value === null ? null : JSON.parse(String(value));
    else out[field] = value;
  }
  return out as T;
}
