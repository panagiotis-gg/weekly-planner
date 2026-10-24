import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { TEXT_LIMITS } from '@planner/shared';
import { citext, timestamps } from './columns';
import { bytea, users } from './identity';

export const planners = pgTable(
  'planners',
  {
    id: uuid().primaryKey(),
    kind: text().notNull(),
    personalOwnerId: uuid()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar({ length: TEXT_LIMITS.plannerName }),
    weekStartDay: smallint().notNull().default(1),
    dayColors: jsonb().$type<Record<string, string>>().notNull().default({}),
    /** Change-feed allocator, row-locked during a push (architecture §5.4). */
    seqCounter: bigint({ mode: 'number' }).notNull().default(0),
    serverSeq: bigint({ mode: 'number' }).notNull().default(0),
    fieldClocks: jsonb().$type<Record<string, string>>().notNull().default({}),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    check('planners_kind', sql`${t.kind} IN ('personal','household')`),
    check('planners_week_start_day', sql`${t.weekStartDay} IN (1,7)`),
    check('planners_personal_owner', sql`(${t.kind} = 'personal') = (${t.personalOwnerId} IS NOT NULL)`),
    check('planners_household_name', sql`${t.kind} = 'personal' OR ${t.name} IS NOT NULL`),
  ],
);

export const plannerMembers = pgTable(
  'planner_members',
  {
    plannerId: uuid()
      .notNull()
      .references(() => planners.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text().notNull(),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.plannerId, t.userId] }),
    uniqueIndex('planner_one_owner').on(t.plannerId).where(sql`${t.role} = 'owner'`),
    index('planner_members_user').on(t.userId),
    check('planner_members_role', sql`${t.role} IN ('owner','editor','viewer')`),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid().primaryKey(),
    plannerId: uuid()
      .notNull()
      .references(() => planners.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    email: citext(),
    secretHash: bytea().notNull().unique(),
    role: text().notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('invitations_planner').on(t.plannerId),
    check('invitations_kind', sql`${t.kind} IN ('email','code')`),
    check('invitations_role', sql`${t.role} IN ('editor','viewer')`),
    check('invitations_email_kind', sql`(${t.kind} = 'email') = (${t.email} IS NOT NULL)`),
  ],
);
