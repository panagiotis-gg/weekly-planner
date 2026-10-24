# Mobile App Structure (`apps/mobile`)

Expo (React Native, TypeScript), expo-router, offline-first. It implements
[architecture.md](architecture.md) §4–§5 and follows [DECISIONS.md](../DECISIONS.md).

## 1. Principles

1. **The local SQLite database is the source of truth for the UI.** Screens read through live
   queries. They never wait on the network, and the server is only reached by the sync engine
   and the online-only flows (auth, households, invites, account deletion).
2. **One write path.** Every content edit goes through a repository, which updates the row,
   stamps field clocks and appends to the outbox in one SQLite transaction.
3. **Domain logic comes from `@planner/shared`** (week math, recurrence, progress, validation,
   merge), never re-implemented in components.
4. **Dependencies point inward:** `app/` (routes) → `features/` → `data/` and `services/` →
   `@planner/shared`. Features don't import each other's internals; shared UI goes in `ui/`.

> **Implementation notes (first milestone, 2026-10-24).** Expo SDK 58 keeps routes in `src/app/`,
> so `app/…` below lives at `src/app/…`. The device data layer uses expo-sqlite directly
> (`src/data/write.ts`, `src/data/repositories/`) rather than Drizzle; see DECISIONS.md.
> On web, the database is opened asynchronously once at start-up, because the SQLite worker must
> load first, and the page must be cross-origin isolated (`metro.config.js` sets the headers in dev).

## 2. Directory layout

```
apps/mobile/
├─ app.config.ts                  Expo config: bundle IDs, plugins (notifications, calendar, apple-auth, sqlite), deep-link scheme "weeklyplanner"
├─ eas.json                       Build profiles: development, preview (internal tracks), production
├─ app/                           expo-router routes (thin: compose feature components)
│  ├─ _layout.tsx                 Providers: DB, theme, i18n, auth gate, sync engine, Sentry
│  ├─ (auth)/
│  │  ├─ sign-in.tsx              Email/password + Google + Apple
│  │  ├─ sign-up.tsx
│  │  └─ forgot-password.tsx
│  ├─ (app)/
│  │  ├─ _layout.tsx              Tab or drawer shell + planner switcher in the header
│  │  ├─ index.tsx                Redirects to the current week of the active planner
│  │  ├─ week/[weekKey].tsx       Week screen (phone) / multi-column week (tablet ≥ 768 dp)
│  │  ├─ day/[date].tsx           Day pager (swipe day to day)
│  │  ├─ event/[id].tsx           Event editor (modal): times, all-day, recurrence, my reminders
│  │  ├─ search.tsx
│  │  ├─ export.tsx               PDF / CSV of the displayed week, JSON backup of all planners
│  │  ├─ planners/
│  │  │  ├─ index.tsx             My planners (personal + households)
│  │  │  ├─ new.tsx               Create household (verified email required)
│  │  │  └─ [id]/
│  │  │     ├─ settings.tsx       Name, week start (Mon/Sun), day colours — owner only
│  │  │     ├─ members.tsx        Roles, remove, transfer ownership
│  │  │     └─ invite.tsx         Email invite / invite code
│  │  └─ settings/
│  │     ├─ index.tsx             Theme (light/dark/system), device calendars to import
│  │     └─ account.tsx           Display name, password, sign out, delete account
│  └─ invite.tsx                  Deep-link target: weeklyplanner://invite?token=… / ?code=…
├─ src/
│  ├─ features/
│  │  ├─ week/                    WeekHeader, MiniCalendars (pick a week; show months spanned), useWeek(weekKey)
│  │  ├─ day/                     DayColumn, DayPager, DayHeader (pastel colour per weekday)
│  │  ├─ focus/                   FocusLine (single line, max 200)
│  │  ├─ tasks/                   TaskList, TaskRow (strikethrough when done), drag reorder, MoveToDaySheet
│  │  ├─ todos/                   WeeklyTodoList, progress bar
│  │  ├─ habits/                  HabitGrid (scheduled days only), HabitEditor (days, stop tracking / delete)
│  │  ├─ events/                  EventList (timed, all-day, device-calendar items), EventForm, RecurrenceSheet, ReminderEditor
│  │  ├─ notes/                   WeekNote, DayNote
│  │  ├─ households/              PlannerSwitcher, MemberList, InviteForm, role guards
│  │  ├─ search/                  SearchBar, results grouped by week/day → navigate
│  │  ├─ export/                  pdfTemplate.ts (HTML planner layout), csv.ts, jsonBackup.ts
│  │  └─ auth/                    forms, social buttons, AuthGate
│  ├─ data/
│  │  ├─ db/
│  │  │  ├─ client.ts             expo-sqlite; opens DB, runs migrations
│  │  │  ├─ migrations.ts         SQL tables mirroring server content tables + outbox, sync_state, kv
│  │  │  ├─ migrations/           drizzle-kit generated SQL
│  │  │  └─ fts.ts                FTS5 index maintenance (triggers on content tables)
│  │  ├─ repositories/            One per entity: dayEntries, weekNotes, tasks, weeklyTodos, habits,
│  │  │                           habitSchedules, habitChecks, events, eventExceptions, eventReminders, planners
│  │  │  └─ base.ts               writeFields(entity, id, fields): validate → stamp HLC → upsert → outbox (one txn)
│  │  └─ queries/                 Live read models: useWeekData, useDayData, useHabitGrid, useSearch
│  ├─ sync/
│  │  ├─ engine.ts                Push outbox → pull pages → merge → notify listeners; single-flight with backoff
│  │  ├─ triggers.ts              App foreground, NetInfo reconnect, debounced after writes, 60 s interval while active
│  │  ├─ merge.ts                 Applies pulled rows with the shared per-field merge
│  │  ├─ membership.ts            Drops planners missing from the pull snapshot; handles CURSOR_EXPIRED re-sync
│  │  └─ hlc.ts                   Device node_id + clock state persisted in kv
│  ├─ api/
│  │  ├─ client.ts                openapi-fetch client generated from the API's OpenAPI document
│  │  ├─ auth.ts                  Token storage (expo-secure-store), refresh-on-401, logout
│  │  └─ errors.ts                problem+json code → i18n message key
│  ├─ services/
│  │  ├─ notifications/           Permission, rolling 60-reminder window, all-day anchored at 09:00, my reminders only
│  │  ├─ deviceCalendar/          expo-calendar read-only fetch for the visible range; never written to the DB
│  │  └─ share.ts                 expo-print / expo-file-system / expo-sharing wrappers
│  ├─ state/
│  │  └─ uiStore.ts               Zustand: active planner, selected week, theme preference (persisted in kv)
│  ├─ ui/
│  │  ├─ theme/                   Tokens, light/dark palettes, default pastel day colours + dark variants
│  │  ├─ components/              Checkbox, ProgressBar (whole %), Sheet, TextField, EmptyState, ReadOnlyBanner
│  │  └─ layout/                  useBreakpoint (phone < 768 dp ≤ tablet), safe areas
│  ├─ i18n/
│  │  ├─ index.ts                 i18next + expo-localization
│  │  └─ en.json                  All UI strings (English only, ready for more locales)
│  └─ lib/
│     ├─ time.ts                  Locale-based 12h/24h formatting of wall-clock times
│     └─ sentry.ts
└─ test/                          Jest + React Native Testing Library; SQLite repositories tested against an in-memory DB
```

## 3. Screens

### Phone (< 768 dp)

| Screen | Contents (screenshot section) |
|---|---|
| **Week** `week/[weekKey]` | Week range header with prev/next arrows; **mini calendars** for the month(s) the week spans (tap a date to jump to its week); **weekly habits** grid with only scheduled days tickable, plus a progress bar; **weekly to-do** checklist with a progress bar; **week note**; a row of seven day chips with each day's task % that opens the day pager. |
| **Day pager** `day/[date]` | Horizontal swipe across days (crossing into the next or previous week). Each page: pastel header (day name + date), **today's focus**, **events** (all-day first, then by start time; device-calendar items marked read-only), **tasks** with a progress bar, **day note**. |
| Event editor | Title, date, all-day toggle, start time, optional end time, recurrence preset with until/count, *my reminders* (multiple custom offsets). For a recurring event: "this occurrence" or "all occurrences". |

### Tablet (≥ 768 dp, any orientation)
`week/[weekKey]` becomes the spreadsheet-like layout: a left panel (mini calendars, habits,
to-dos, week note) and seven horizontally scrolling day columns (focus, events, tasks, day note).
Tapping an item opens the same sheets as on phone. The day pager is still reachable.

### Viewer role
A `ReadOnlyBanner` is shown, and edit affordances are hidden through a `useCanEdit(plannerId)`
guard. Repositories also refuse writes for viewer planners, a second check before the server's.

## 4. Data flow

```
Component ──calls──▶ feature hook (e.g. useToggleTask)
                      └─▶ repository.writeFields('task', id, {done:true})
                            ├─ zod validate (shared schema)
                            ├─ HLC stamp per field
                            ├─ SQLite txn: upsert row + field_clocks, append outbox
                            └─ emit change ─▶ live queries re-run ─▶ UI updates instantly
                                           └─▶ sync trigger (debounced) ─▶ engine.push/pull
```

Read models compute derived values with shared functions:
- `useWeekData(plannerId, weekKey)` → week bounds from the planner's `weekStartDay`, habit grid
  (the schedule version for that week), to-dos, week note, progress %.
- `useDayData(plannerId, date)` → focus/note, tasks ordered by `position`, events (recurrence
  expanded for the day, exceptions applied) merged with device-calendar events.

## 5. Key behaviours mapped to decisions

| Decision | Where it lives |
|---|---|
| Week start Mon/Sun per planner (A1) | `planners.weekStartDay` → `shared/week` in `useWeek` |
| Mini calendars pick the week; months spanned (A2) | `features/week/MiniCalendars` |
| Habits persist, scheduled days, versioned from the current week (A3, Q9, Q15) | `features/habits`, `habitSchedules` repository |
| No to-do carry-over (A4); no task roll-over, reorder and move (A7) | Absence of any copy job; `tasks.position` and `tasks.date` writes |
| Focus ≤ 200 (A5); limits (Q1) | Shared Zod schemas, `maxLength` on inputs |
| Events: optional end, all-day, recurrence presets, exceptions (A6, Q7, Q8) | `features/events`, `shared/recurrence` |
| Local, personal reminders, rolling window, all-day at 09:00 (A6, Q5, Q6) | `services/notifications` |
| Read-only device calendar import (A6) | `services/deviceCalendar` |
| Past weeks editable (A8) | No date-based locks anywhere |
| Pastel look, per-planner day colours (A9, Q4) | `ui/theme` + `planners.dayColors` |
| Notes, search, export (A10, Q16) | `features/notes`, `features/search` (FTS5), `features/export` |
| Households, roles, invites (C3, Q2, Q10, Q11) | `features/households`, `app/(app)/planners`, `app/invite.tsx` |
| Account deletion with 30-day grace (C2) | `settings/account.tsx` → `DELETE /me`, then sign out and wipe the local DB |
| Full offline + per-field merge (E1, E2) | `data/repositories/base.ts`, `sync/` |
| Dark mode, i18n-ready, locale time (F3) | `ui/theme`, `i18n/`, `lib/time.ts` |

## 6. Main libraries

expo-router · expo-sqlite + drizzle-orm · zustand · zod (via `@planner/shared`) · openapi-fetch ·
expo-secure-store · @react-native-community/netinfo · expo-notifications · expo-calendar ·
expo-apple-authentication · expo-auth-session (Google) · expo-print · expo-file-system ·
expo-sharing · expo-localization + i18next/react-i18next · react-native-gesture-handler +
react-native-reanimated (swipe pager, drag reorder) · @sentry/react-native · jest-expo +
@testing-library/react-native.
