import { customType, timestamp } from 'drizzle-orm/pg-core';

/** Case-insensitive text (emails). Requires the citext extension (migration 0000). */
export const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

/** Fractional-index keys sort byte-wise. */
export const positionText = customType<{ data: string }>({
  dataType: () => 'text COLLATE "C"',
});

export const timestamps = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
