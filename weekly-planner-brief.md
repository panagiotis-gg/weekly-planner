# Weekly Planner Mobile App — Project Brief (handoff to Claude Code)

## Your role
You are a senior full-stack software architect and mobile developer.

## Rules (non-negotiable)
- You MUST NOT make assumptions. Do NOT invent business logic or fields that are not explicitly defined.
- If any requirement is unclear or missing, ASK before proceeding.
- **Do not write implementation code until every open question in §4 is answered by the user.**
- Keep everything modular, scalable and production-ready.
- The entire system MUST be Dockerized (backend + database, via docker-compose, easy local dev).

## 1. Goal
Build a mobile app for iOS and Android: a weekly planner that supports the features of a
reference spreadsheet planner (described in §3; the user may also attach the screenshot).

## 2. General requirements
- Cross-platform mobile framework (suggest one, but the user decides)
- Backend in Docker, database in Docker, docker-compose.yml provided
- Clean architecture (separation of concerns)
- REST or GraphQL API (the user decides)
- Authentication (the user decides scope)
- Input validation, error handling, logging
- Scalable database schema

## 3. Reference screenshot — what it shows
A Google-Sheets-style "WEEKLY PLAN" template. Tabs at the bottom: "READ ME FIRST" and
"Weekly Template (Duplicate for each week)".

**Left panel**
- **Choose week start** (e.g. Jun 9, 2025) → **Week end** calculated (Jun 15, 2025). Weeks run Mon–Sun.
- **Two mini month calendars** (June, July 2025) with the selected week highlighted.
- **Weekly habits**: named habits (e.g. "8 hrs sleep", "morning walk", "no social after 9 pm",
  "take vitamins", "journal entry", "water plants", "floss", "stretch before bed") with one
  checkbox per day M T W T F S S, plus a progress bar with an overall % (52.4%).
- **Weekly to-do list**: checklist not tied to a day (e.g. "refill prescription",
  "book dentist appointment"), with a progress bar and % (77.8%).

**Day columns (Monday → Sunday)**, each with its own pastel header colour:
- Day name + date
- **Today's focus**: one free-text line (e.g. "weekly cleaning chores")
- **Events**: time + description rows (e.g. "9:30 AM — meeting with the team")
- **Tasks**: checklist; checked items are shown struck through; progress bar with % per day (45%, 63%)

Interpretation so far: text such as "stick to budget ($150)" is plain task text, not a budget feature.
The "READ ME FIRST" tab is spreadsheet instructions, not an app feature. Both are unconfirmed (see A10).

## 4. Open questions — ask the user and get answers BEFORE designing

### A. Feature scope (confirm or correct the reading above)
- A1 Week start: always Monday, or user-configurable?
- A2 Mini calendars: used to pick the week, or display only? Which months are shown: current + next, or the months the week spans?
- A3 Habits: do they persist across weeks or get defined per week? Is % = checked ÷ (habits × 7)? Can a habit apply to some days only? Is there a maximum count?
- A4 Weekly to-dos: do unchecked items carry over to the next week?
- A5 Today's focus: a single line? Is there a length limit?
- A6 Events: start time only, or start + end? Recurring? Reminders or push notifications? Device-calendar sync?
- A7 Daily tasks: reorder? Move to another day? Roll over unfinished tasks? A per-day limit?
- A8 Multiple weeks: are past weeks viewable and editable or read-only? Does a new week copy anything (habits, unfinished to-dos)?
- A9 Visual style: replicate the pastel per-day look, or treat it as reference only?
- A10 Out of scope: confirm the budget text and READ ME tab are not features. Are there extras not in the screenshot (notes, sharing, export, search)?

### B. Tech stack
- B1 Mobile: (a) React Native + Expo [suggested], (b) Flutter, (c) other
- B2 Backend: (a) Python FastAPI, (b) Node NestJS, (c) other
- B3 Database: (a) PostgreSQL [suggested], (b) MySQL, (c) other
- B4 API: (a) REST + OpenAPI [suggested], (b) GraphQL

### C. Authentication and users
- C1 Auth: (a) none, single device; (b) email + password; (c) Google/Apple social login (if offered, Sign in with Apple is required on iOS); (d) a combination
- C2 In-app account deletion (App Store requirement if accounts exist)?
- C3 Roles: single-user only, or sharing (household, read-only viewer) or an admin role?

### D. Deployment
- D1 Backend target: local/self-hosted, a specific cloud (which), or cloud-agnostic
- D2 Distribution: public App Store/Play Store, or internal (TestFlight / internal testing)? This decides whether CI/CD for builds is needed.
- D3 Expected scale: one user, tens, or thousands?

### E. Offline support
- E1 (a) online only, (b) read-only offline cache, (c) fully offline with sync
- E2 If (c): conflict resolution — last-write-wins, or per-field merge?

### F. UI/UX
- F1 Phone only, or tablet layouts too? Portrait only?
- F2 Phone week layout (seven columns won't fit): (a) swipe day-to-day plus a weekly summary screen for habits and to-dos, (b) one vertical scrolling week, (c) other
- F3 Dark mode? Languages (English only, or Greek too)? 12-hour or 24-hour time?

### G. Non-functional
- G1 Logging: structured stdout logs from the containers, or a specific tool (Sentry, ELK, Grafana/Loki)?
- G2 Testing expectations: unit only, or unit + integration + end-to-end?

## 5. Deliverables (only after §4 is answered)
1. System architecture
2. Database schema
3. API design
4. Docker setup (Dockerfiles + docker-compose.yml, local dev instructions)
5. Mobile app structure
6. Key code snippets, then implementation

Everything must be based strictly on confirmed requirements. Record each answer from the user
in a `DECISIONS.md` file in the repo before starting the design.
