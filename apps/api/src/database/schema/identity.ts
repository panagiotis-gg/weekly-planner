import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { TEXT_LIMITS } from '@planner/shared';
import { citext, timestamps } from './columns';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey(),
    email: citext().notNull().unique(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    passwordHash: text(), // null for social-only accounts
    displayName: varchar({ length: TEXT_LIMITS.displayName }),
    isAdmin: boolean().notNull().default(false),
    disabledAt: timestamp({ withTimezone: true }),
    deletionScheduledFor: timestamp({ withTimezone: true }),
    lastLoginAt: timestamp({ withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('users_deletion_due')
      .on(t.deletionScheduledFor)
      .where(sql`${t.deletionScheduledFor} IS NOT NULL`),
  ],
);

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text().notNull(),
    providerSubject: text().notNull(),
    email: citext(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.provider, t.providerSubject),
    index('auth_identities_user').on(t.userId),
    check('auth_identities_provider', sql`${t.provider} IN ('google','apple')`),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid().notNull(),
    tokenHash: bytea().notNull().unique(),
    deviceLabel: varchar({ length: 100 }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    replacedBy: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('refresh_tokens_user').on(t.userId), index('refresh_tokens_family').on(t.familyId)],
);

export const emailTokens = pgTable(
  'email_tokens',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text().notNull(),
    tokenHash: bytea().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('email_tokens_purpose', sql`${t.purpose} IN ('verify_email','reset_password')`)],
);

export { bytea };
