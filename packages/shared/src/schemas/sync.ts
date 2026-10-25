import { z } from 'zod';
import { SYNC_LIMITS } from '../limits';
import {
  dayEntryFields,
  eventExceptionFields,
  eventFields,
  reminderFields,
  completionFields,
  habitFields,
  habitScheduleFields,
  plannerFields,
  taskFields,
  weekNoteFields,
  weeklyTodoFields,
} from './entities';
import { hlcSchema, nodeIdSchema, uuidSchema } from './primitives';

/** Sync API DTOs (api-design.md §6). */

export const ENTITY_TYPES = [
  'planner',
  'day_entry',
  'week_note',
  'task',
  'weekly_todo',
  'habit',
  'habit_schedule',
  'completion',
  'event',
  'event_exception',
  'reminder',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
export const entityTypeSchema = z.enum(ENTITY_TYPES);

/** Writable fields per entity type. */
export const ENTITY_FIELD_SCHEMAS = {
  planner: plannerFields,
  day_entry: dayEntryFields,
  week_note: weekNoteFields,
  task: taskFields,
  weekly_todo: weeklyTodoFields,
  habit: habitFields,
  habit_schedule: habitScheduleFields,
  completion: completionFields,
  event: eventFields,
  event_exception: eventExceptionFields,
  reminder: reminderFields,
} as const satisfies Record<EntityType, z.ZodObject>;

export const mutationSchema = z
  .strictObject({
    entityType: entityTypeSchema,
    id: uuidSchema,
    plannerId: uuidSchema,
    fields: z.record(z.string(), z.unknown()),
    clocks: z.record(z.string(), hlcSchema),
  })
  .superRefine((m, ctx) => {
    const fieldKeys = Object.keys(m.fields).sort();
    const clockKeys = Object.keys(m.clocks).sort();
    if (fieldKeys.length === 0) ctx.addIssue({ code: 'custom', message: 'NO_FIELDS', path: ['fields'] });
    if (fieldKeys.join() !== clockKeys.join()) {
      ctx.addIssue({ code: 'custom', message: 'CLOCKS_DO_NOT_MATCH_FIELDS', path: ['clocks'] });
    }
    const parsed = ENTITY_FIELD_SCHEMAS[m.entityType].partial().safeParse(m.fields);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: ['fields', ...issue.path] });
      }
    }
  });
export type Mutation = z.infer<typeof mutationSchema>;

export const pushRequestSchema = z.strictObject({
  nodeId: nodeIdSchema,
  mutations: z.array(mutationSchema).min(1).max(SYNC_LIMITS.pushMaxMutations),
});
export type PushRequest = z.infer<typeof pushRequestSchema>;

export const PUSH_STATUSES = ['applied', 'stale', 'rejected'] as const;

export const pushResultSchema = z.object({
  id: uuidSchema,
  entityType: entityTypeSchema,
  status: z.enum(PUSH_STATUSES),
  code: z.string().optional(),
  /** Authoritative row (with fieldClocks) to adopt after a rejection; null if it doesn't exist. */
  current: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type PushResult = z.infer<typeof pushResultSchema>;

export const pushResponseSchema = z.object({
  results: z.array(pushResultSchema),
  serverTime: z.iso.datetime(),
});
export type PushResponse = z.infer<typeof pushResponseSchema>;

export const pullRequestSchema = z.strictObject({
  cursors: z.record(uuidSchema, z.number().int().min(0)),
  limit: z.number().int().min(1).max(SYNC_LIMITS.pullMaxPageSize).optional(),
});
export type PullRequest = z.infer<typeof pullRequestSchema>;

export const PLANNER_KINDS = ['personal', 'household'] as const;
export const PLANNER_ROLES = ['owner', 'editor', 'viewer'] as const;
export type PlannerKind = (typeof PLANNER_KINDS)[number];
export type PlannerRole = (typeof PLANNER_ROLES)[number];

export const pullResponseSchema = z.object({
  planners: z.array(
    z.object({ id: uuidSchema, kind: z.enum(PLANNER_KINDS), role: z.enum(PLANNER_ROLES) }),
  ),
  changes: z.array(
    z.object({
      entityType: entityTypeSchema,
      plannerId: uuidSchema,
      serverSeq: z.number().int(),
      row: z.record(z.string(), z.unknown()),
      fieldClocks: z.record(z.string(), hlcSchema),
    }),
  ),
  cursors: z.record(uuidSchema, z.number().int().min(0)),
  hasMore: z.boolean(),
});
export type PullResponse = z.infer<typeof pullResponseSchema>;
