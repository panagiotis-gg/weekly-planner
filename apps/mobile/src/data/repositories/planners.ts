import { newId, PlannerRole, WeekStartDay } from '@planner/shared';
import { getDb, kvGet, kvSet } from '../db/client';
import { decodeRow } from '../entities';
import { writeFields } from '../write';

export interface LocalPlanner {
  id: string;
  kind: 'personal' | 'household';
  role: PlannerRole;
  name: string | null;
  weekStartDay: WeekStartDay;
  dayColors: Partial<Record<'1' | '2' | '3' | '4' | '5' | '6' | '7', string>>;
}

const ACTIVE_PLANNER_KEY = 'active_planner';

/**
 * Until sign-in exists, the app works on a local personal planner created on first launch.
 * When accounts arrive, the first sign-in will bind this planner to the server's personal planner.
 */
export function ensureLocalPlanner(): string {
  const db = getDb();
  const existing = kvGet(ACTIVE_PLANNER_KEY);
  if (existing && db.getFirstSync('SELECT 1 FROM planners WHERE id = ?', [existing])) return existing;
  const id = newId();
  db.runSync("INSERT INTO planners (id, kind, role, week_start_day) VALUES (?, 'personal', 'owner', 1)", [id]);
  kvSet(ACTIVE_PLANNER_KEY, id);
  return id;
}

export function getPlanner(id: string): LocalPlanner {
  const raw = getDb().getFirstSync<Record<string, unknown>>('SELECT * FROM planners WHERE id = ?', [id]);
  if (!raw) throw new Error(`Planner ${id} not found`);
  return decodeRow<LocalPlanner>('planner', raw);
}

export function setWeekStartDay(planner: LocalPlanner, weekStartDay: WeekStartDay): void {
  writeFields('planner', planner.id, planner.id, { weekStartDay });
}

export function setDayColor(planner: LocalPlanner, weekday: number, color: string | null): void {
  const dayColors = { ...planner.dayColors };
  const key = String(weekday) as keyof LocalPlanner['dayColors'];
  if (color) dayColors[key] = color;
  else delete dayColors[key];
  writeFields('planner', planner.id, planner.id, { dayColors });
}
