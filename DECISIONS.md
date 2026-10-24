# Decisions — Weekly Planner App

Answers to the open questions in `weekly-planner-brief.md` §4, recorded 2026-10-24.
Items marked **(derived)** follow from the answers but were not asked directly; confirm or correct them.

## A. Feature scope

| # | Topic | Decision |
|---|-------|----------|
| A1 | Week start | User-configurable: **Monday or Sunday** (default Monday). Set **per planner** (household owner sets it for the household planner). |
| A2 | Mini calendars | Show only the month(s) the selected week spans (one or two). **Tapping a date opens that day's page** (changed by the user 2026-10-24; was "used to pick the week"). Weeks change with the ‹ › arrows and "Today". |
| A3 | Habits | **Persist across weeks** (a habit list, fresh checkboxes each week). A habit can be scheduled on **selected days only**. **No limit** on count. % = checked ÷ scheduled habit-days. |
| A4 | Weekly to-dos | **No carry-over.** Each week's list is independent. % = checked ÷ total. |
| A5 | Today's focus | **One line, max 200 characters.** |
| A6 | Events | Start time + **optional end time**; **all-day events** supported. **Recurring**: basic presets (daily, weekdays, weekly on chosen days, monthly, yearly; optional end date or count; edit "this" or "all" occurrences). **Reminders**: **local device notifications**, **multiple per event, custom offsets**. **Device calendar sync: import, read-only** (device events shown in day columns, not editable in-app). |
| A7 | Daily tasks | **Reorder within a day** and **move to another day** (any week). No auto roll-over, no per-day limit. % = checked ÷ that day's tasks. Done tasks shown struck through. |
| A8 | Multiple weeks | Past weeks **viewable and editable**. A new week is pre-filled with **nothing** beyond persistent habits and recurring events. |
| A9 | Visual style | **Pastel look replicated**, with **user-changeable per-day colours**. |
| A10 | Scope | Budget text is plain task text; READ ME tab is not a feature (**confirmed**). Extras in scope: **Notes** (one per week **and** one per day), **Search** (all text — tasks, to-dos, events, focus, notes, habits — across all weeks; results jump to week/day), **Export** (PDF of a week, CSV, full JSON backup), **Sharing** (shared household planners, see C3). |
| A11 | Calendar overview (requested 2026-10-24) | Quiet, three levels: (1) each visible day shows a **ring of its task progress** (only days with tasks; partial credit as in J5) and a **dot when it has events**; today's number is shown in the **accent colour**. (2) One **summary line** for the selected week: tasks done/total · events · habits %. (3) The selected week **expands** (chevron) into a per-day row: task bar + done/total, first event (time or All day), habits done/due — **collapsed by default, remembered on this device**. No legend. |
| — | Progress % display | **Whole numbers** (e.g. 45%). |

## B. Tech stack

| # | Decision |
|---|----------|
| B1 | **React Native + Expo** (TypeScript) |
| B2 | **NestJS** (TypeScript). Chosen so domain logic (types, validation, week math, recurrence expansion, progress %, sync/merge) lives in one shared package used by app and server — needed for offline mode. |
| B3 | **PostgreSQL** |
| B4 | **REST + OpenAPI** |

## C. Authentication and users

| # | Decision |
|---|----------|
| C1 | **Email + password, Google, and Sign in with Apple.** Email provider: **generic SMTP** (Mailpit container for local dev). |
| C2 | In-app account deletion with a **30-day grace period** (soft delete, purged after 30 days unless the user logs back in). |
| C3 | Each user has a personal planner and can belong to **many household planners**. Household roles: **owner, editor, viewer**. Invites by **email and by invite code/link**. Household planner has the **identical structure** to a personal one; household habits use **one shared checkbox** per day. Owner **must transfer ownership** before leaving/deleting their account; a sole-member household is deleted with the account. **Basic admin API** (list/disable users, view stats) — no admin UI. |

## D. Deployment

| # | Decision |
|---|----------|
| D1 | **Cloud-agnostic Docker** (docker-compose for local dev; same images in production). |
| D2 | **Internal testing first** (TestFlight / Play internal track), designed for **public store compliance later**. |
| D3 | **Thousands of users** → stateless API (horizontally scalable), rate limiting, monitoring. |

## E. Offline support

| # | Decision |
|---|----------|
| E1 | **Fully offline with sync** — the app must work when the server is down; reads and edits are stored locally and synced when the server is reachable. |
| E2 | Conflict resolution: **per-field merge** (different fields both survive; same field → latest edit wins). |
| — | **(derived)** Operations that inherently need the server are unavailable offline: first sign-in / sign-up, accepting or sending invites, account deletion, admin API. Everything else works offline after the first sign-in. |

## F. UI/UX

| # | Decision |
|---|----------|
| F1 | **Phone and tablet, all orientations.** Tablet gets a wider multi-column week layout. |
| F2 | Phone: **swipe day-to-day** (focus, events, tasks, day note) plus a **Week screen** (mini calendars first, then habits, weekly to-dos, week note). The separate "Days" list was removed by the user on 2026-10-24: days open from the calendar. |
| F3 | Dark mode: **light / dark / follow system**. Language: **English only, i18n-ready** (strings externalised). Time format: **follows device locale** (12h/24h). |
| — | Event times stored as **local wall-clock time** (no time-zone shifting when travelling; all household members see the same wall time). |

## G. Non-functional

| # | Decision |
|---|----------|
| G1 | **Structured JSON logs to stdout** from containers + **Sentry** (backend and mobile). |
| G2 | **Unit + integration tests** (integration against PostgreSQL in Docker). No mobile E2E. |

The "(derived)" offline limitation in §E was confirmed by the user on 2026-10-24.

## H. Design follow-ups (Q1–Q16 from `docs/open-questions.md`, all proposals accepted 2026-10-24)

| # | Topic | Decision |
|---|-------|----------|
| Q1 | Length limits | Task, to-do and event titles and habit names: **200 chars**. Week and day notes: **10 000 chars**. Focus stays at 200. |
| Q2 | Household name | **Required**, 1–60 chars; the owner can rename it. |
| Q3 | User identity in member lists | Optional **display name** (≤ 60 chars), falling back to email. |
| Q4 | Day colours | A **per-planner** setting (owner edits; all members see the same). |
| Q5 | Household reminders | Reminders are **personal**: each member sets their own on any event; only their devices notify. |
| Q6 | All-day event reminders | Offsets are measured from **09:00** on the event day. |
| Q7 | Monthly from the 29th–31st / yearly from Feb 29 | Months (years) without that day are **skipped** (RFC 5545 behaviour). |
| Q8 | Events past midnight | Not allowed: end time must be **later than start time on the same day**. |
| Q9 | Habit rename / removal | Rename applies to **all weeks**. **Stop tracking** = gone from the current week on, past weeks keep it. **Delete** = removed from every week, after confirmation. |
| Q10 | Email verification | App usable immediately. A **verified email is required** to create a household or to send or accept invites. Social-login emails count as verified. |
| Q11 | Invites | **Email invite**: single use, 7-day expiry, accepted only by an account whose verified email matches. **Code/link**: multi-use until revoked, 7-day expiry, 8-character code. Owner picks the role (editor or viewer) when inviting. |
| Q12 | Social-login account linking | Auto-link to an existing account **only when the provider asserts the email is verified**; otherwise create a separate account. |
| Q13 | Admin stats | User totals (all, verified, disabled, pending deletion), active users in the last 7 and 30 days, planner counts (personal, household). |
| Q14 | Granting admin | CLI command in the API container: `admin:grant <email>`. No self-service. |
| Q15 | Mid-week habit changes | New habits and new day selections apply from the **current** week. |
| Q16 | Export scope | PDF and CSV: the **displayed week** of the planner on screen. JSON backup: **all planners** the user belongs to. |

## I. Technical defaults (accepted 2026-10-24)

pnpm workspaces + Turborepo · Node.js 22 LTS · Drizzle ORM + drizzle-kit on the server; expo-sqlite directly on the device (see change below) ·
Zod + nestjs-zod + @nestjs/swagger, openapi-typescript client · expo-router, local DB as source of truth + Zustand ·
UUIDv7 (client) / UUIDv5 (deterministic rows) · per-field hybrid logical clocks · fractional-index ordering ·
argon2id, 15-min JWT access tokens, 60-day sliding rotating refresh tokens with reuse detection ·
Redis + BullMQ, @nestjs/throttler with Redis storage · Nodemailer over SMTP, Mailpit for dev · pino JSON logs + Sentry ·
Jest + Testcontainers · tombstone retention 90 days · push ≤ 500 mutations, pull pages of 1000 rows ·
rolling window of the next 60 local notifications.

**Change accepted by the user (2026-10-24):** on the device, use expo-sqlite directly instead of
Drizzle. The sync layer writes rows generically (any entity, any subset of fields, per-field clocks), which is
simpler as SQL driven by an entity table than as typed per-table Drizzle queries, and it avoids bundling
drizzle-kit migrations into the app. The server keeps Drizzle.

## J. Targets ("how many days / times") — decided 2026-10-24

| # | Topic | Decision |
|---|-------|----------|
| J1 | Scope | An **optional target** can be set on **habits**, **weekly to-dos** and **day tasks**. No target = today's behaviour. |
| J2 | Habit target types | **A** days per week · **B** times per week (any spread, no per-day cap) · **C** times per day, on **every** selected day · **D** times per day on at least N days. Only the habit's **selected days** count (select all 7 for "any day"). |
| J3 | Weekly to-do target types | The same four types (A–D); all 7 days of that week count. |
| J4 | Day task targets | **N times that day**, optionally **spread** over consecutive days: the task's date + a **number of days** (may cross into the next week). A spread task appears in **every day's Tasks list in its span** with that day's own counter and a note like "day 2 of 5" — one task, not copies. Each day's entry is done when that day's target is met (counts in that day's %); the task is fully done when every day of the span is met. Start and length can be edited later: counts on dates still inside the span are kept; counts on dates that fall outside are discarded after a confirmation. |
| J5 | Done rule (to-dos and tasks) | Struck through automatically **only when the target is reached**; before that it shows partial progress (e.g. 1/3) and counts as **partially done** in the list %: each item contributes min(count, target) ÷ target. (Refines A4/A7 progress for items with targets.) |
| J6 | Recording | A **checkbox** when once a day is enough; otherwise a **counter** (e.g. 5/8). Tap = +1; undo = **"−1" in the item's menu**. |
| J7 | Storage / offline | **One record per completion** (append-only); a day's count = number of live records; undo removes the latest. Concurrent offline taps on two devices both survive sync. Existing habit ticks migrate to one completion each. |
| J8 | Over-achievement | Allowed; shown as e.g. 9/8; progress capped at 100%. |
| J9 | Per-item progress % | A: qualifying days ÷ N. B: times ÷ N. C: Σ over countable days of min(count, per-day target) ÷ (per-day target × countable days). D: same per-day credit over the best N days. None: as today. |
| J10 | Overall habits % (**changes A3**) | **Average of the habits' individual %** (each habit weighs the same), instead of checked ÷ scheduled habit-days. |
| J11 | "Achieved" display | ✓ badge and tinted row per item per week; days whose own daily target is met are highlighted. |
| J12 | Limits | Times per day 1–20; times per week 1–100; days per week 1 … number of countable days; a spread day task spans **2–31 days** (accepted 2026-10-24). |
| J13 | Changes over time | Habit targets are versioned with the day selection: a change applies from the **current week**; earlier weeks keep their target and result. To-dos and tasks are one-off, so edits apply to that item. |
| J14 | Notifications | None tied to targets for now. |
| J15 | Where habits appear | Week screen grid **and** a new **"Today's habits"** section on each day page (above Tasks), with +/−; both show the same record. Habits are not copied into the Tasks or to-do lists. |
| J16 | After a habit's weekly target is met | **Per-habit setting** in the habit editor: keep showing it in "Today's habits" (marked ✓, extra sessions can be recorded) or hide it until next week. Default: **keep showing** (accepted 2026-10-24). |
