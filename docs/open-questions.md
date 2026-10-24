# Design Questions & Technical Defaults — RESOLVED

**Status (2026-10-24): every proposal below was accepted and is recorded in
[DECISIONS.md](../DECISIONS.md) §H and §I.** The ⟨Qn⟩ markers in the other design docs now refer
to these accepted decisions.

## A. Product questions (need your answer)

| # | Question | Proposal |
|---|----------|----------|
| Q1 | Text length limits for task titles, to-do titles, event titles, habit names and notes? (Focus = 200 is confirmed.) | Titles/names 200 chars; week and day notes 10 000 chars. |
| Q2 | Does a household planner need a name (to tell several households apart)? | Yes, required, 1–60 chars. Owner can rename. |
| Q3 | How are users identified in member lists? | Optional display name (≤ 60 chars), falling back to email. |
| Q4 | Per-day colours: a planner setting (the household owner sets them, all members see the same) or a per-user preference? | Per planner, like week start. |
| Q5 | Reminders on events in a household planner: who gets notified? | Reminders are **personal**. Each member adds their own reminders to any event, and only their devices notify. |
| Q6 | Reminder offsets for **all-day** events: relative to what time? | Relative to 09:00 on the event day (so "1 day before" = 09:00 the previous day). |
| Q7 | Monthly repeat from the 29th–31st, and yearly from Feb 29: what happens in months without that day? | Skip those months (calendar-standard RFC 5545 behaviour). Alternative: move it to the last day of the month. |
| Q8 | Can an event end after midnight (end time earlier than start time)? | No. End time must be later than start time on the same day. |
| Q9 | Habits — rename and removal: does a rename change past weeks too? What does removing a habit do? | Rename applies to all weeks (the name isn't versioned). Two removal actions: **Stop tracking** (gone from this week on, past weeks keep it) and **Delete** (removed from every week, with confirmation). |
| Q10 | Must users verify their email before doing anything? | The app is usable immediately. A verified email is required to create a household or to send or accept invites. Social-login emails count as verified. |
| Q11 | Invite rules? | **Email invite**: single use, expires after 7 days, can only be accepted by an account whose verified email matches. **Code/link**: multi-use until revoked, expires after 7 days, 8-character code. The owner picks the role (editor or viewer) when inviting. |
| Q12 | If someone signs in with Google/Apple and an account with that email already exists, are the accounts linked? | Link automatically only when the provider asserts the email is verified. Otherwise create a separate account. |
| Q13 | What should admin stats include? | User totals (all, verified, disabled, pending deletion), active users in the last 7 and 30 days, planner counts (personal, household). |
| Q14 | How does someone become admin? | A CLI command run in the API container (`admin:grant <email>`). No self-service. |
| Q15 | Habits created or rescheduled mid-week: from which week does the change apply? | From the **current** week (a new habit appears in the week it was created; a new day selection applies to the current week and later). |
| Q16 | Export scope: which planners does each export cover? | PDF and CSV: the week of the planner on screen. JSON backup: all planners the user belongs to. |

## B. Technical defaults (chosen by me; tell me if you want any changed)

| Area | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Shared TS package between app and API |
| Runtime | Node.js 22 LTS | Current LTS |
| ORM / migrations | Drizzle + drizzle-kit on the server; expo-sqlite directly on the device (changed 2026-10-24) | SQL-first migrations; generic sync writes are simpler in plain SQL on the device |
| Validation / OpenAPI | Zod + nestjs-zod + @nestjs/swagger; openapi-typescript client | Single source of truth for types |
| Mobile navigation / state | expo-router; local DB is the source of truth (live queries) + Zustand for UI state | Offline-first |
| IDs | UUIDv7 (client-generated), UUIDv5 for deterministic rows | Offline creation without conflicts |
| Merge clock | Hybrid logical clock per field | Per-field merge (E2) |
| Ordering | Fractional indexing keys | Offline reordering without renumbering |
| Passwords / tokens | argon2id; 15-min JWT access; 60-day sliding refresh with rotation and reuse detection | Common secure defaults; offline use doesn't depend on token validity |
| Queue / rate limits | Redis + BullMQ; @nestjs/throttler with Redis storage | Works across API replicas (D3) |
| Email | Nodemailer over SMTP; Mailpit in docker-compose for dev | Generic SMTP (C1) |
| Logging | pino (nestjs-pino), JSON to stdout; Sentry SDKs | G1 |
| Tests | Jest; Testcontainers for Postgres integration tests | G2 |
| Tombstone retention | 90 days; devices offline longer than that re-sync from scratch (their outbox is kept) | Bounds table growth |
| Push batch size | ≤ 500 mutations per request; pull pages of 1000 rows | Keeps request sizes and lock times small |
| Local notifications | Rolling window of the next 60 reminders | iOS caps pending local notifications at 64 |
