/** Text limits (DECISIONS A5, Q1, Q2, Q3). */
export const TEXT_LIMITS = {
  focus: 200,
  title: 200,
  habitName: 200,
  note: 10_000,
  plannerName: 60,
  displayName: 60,
} as const;

/** Sync batch sizes (DECISIONS §I). */
export const SYNC_LIMITS = {
  pushMaxMutations: 500,
  pullMaxPageSize: 1000,
} as const;

/** Business durations (DECISIONS C2, Q11). */
export const DURATIONS = {
  accountDeletionGraceDays: 30,
  inviteTtlDays: 7,
} as const;

/** All-day event reminders are measured from this wall-clock time (DECISIONS Q6). */
export const ALL_DAY_REMINDER_ANCHOR = '09:00';

/** Invite codes are 8 characters (DECISIONS Q11). */
export const INVITE_CODE_LENGTH = 8;
