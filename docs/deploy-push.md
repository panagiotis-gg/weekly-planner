# Reminder notifications on iPhone (push service)

Reminders (DECISIONS K1–K10) reach the iPhone as **Web Push**. A Home Screen web app can't
schedule notifications on the phone itself, so a small service on your free Cloudflare account
sends each one at its time: the **`weekly-planner-push` Worker** (`apps/push`).

What it stores (K3): for each device that turned notifications on, its push address, and the
reminders of the next 30 days: time, the item's title and day/time, and which day a tap opens.
Nothing else from the planner leaves the phone.

## One-time setup (about 10 minutes)

You need the Cloudflare account that already hosts the app (Pages).

### 1. Create the database

1. Cloudflare dashboard → **Storage & Databases → D1 SQL Database → Create**.
2. Name: `weekly-planner-push` → **Create**.
3. Copy its **Database ID** (a long code such as `1a2b3c4d-…`) and put it in
   `apps/push/wrangler.toml` as `database_id` (or send it to whoever maintains the repo).
   It is an identifier, not a password. The Worker creates its tables itself.

### 2. Check the app address

In `apps/push/wrangler.toml`, `APP_ORIGIN` must be the app's address exactly as Cloudflare
Pages shows it (for example `https://weekly-planner.pages.dev`). Only that site may talk to the
service.

### 3. Create the Worker from GitHub

1. Dashboard → **Workers & Pages → Create → Import a repository** → pick
   `panagiotis-gg/weekly-planner`.
2. Settings:
   - **Project name:** `weekly-planner-push`
   - **Root directory:** leave empty (the repository root)
   - **Build command:** leave empty
   - **Deploy command:** `pnpm --filter @planner/push run deploy`
3. **Create and deploy.** When it finishes, the Worker's address is shown, e.g.
   `https://weekly-planner-push.<your-name>.workers.dev`. Open
   `<that address>/vapid-key` in a browser: it should show `{"publicKey":"…"}`.

From then on every push to `main` redeploys it, like the app. The every-minute schedule comes
from `wrangler.toml` (`crons`).

### 4. Tell the app where the service is

1. Dashboard → **Workers & Pages → weekly-planner (the Pages project) → Settings → Variables and
   secrets → Add**.
2. Name `EXPO_PUBLIC_PUSH_URL`, value: the Worker address from step 3 (no trailing `/`),
   environment **Production**.
3. **Deployments → … → Retry deployment** on the latest one, so the app is rebuilt with it.

### 5. Turn notifications on (on the iPhone)

1. Open **Weekly Plan from the Home Screen** (iOS 16.4 or later; Safari tabs can't receive push).
2. Close and reopen it once or twice until Settings shows the new version.
3. **Settings → Notifications → Turn on notifications → Allow.**
4. **Send a test notification**: it should appear within a few seconds.

Each iPhone (or browser) that should notify turns it on once.

## How it works

| Piece | Where |
|---|---|
| Reminder settings on events, tasks, habits, to-dos | `apps/mobile/src/features/reminders/ReminderPicker.tsx` and the item editors |
| Upcoming notifications (occurrences, habit days, 09:00 default, skip done, 30 days) | `apps/mobile/src/features/reminders/schedule.ts` |
| Subscribe, register, keep the service's list current | `apps/mobile/src/features/reminders/push.ts` |
| Show the push, open the day on tap | `apps/mobile/public/push-sw.js` (loaded by the generated `sw.js`) |
| The service (API, cron, VAPID keys in D1) | `apps/push/src/index.ts`, `apps/push/wrangler.toml` |

The app sends its list when it opens, comes to the foreground, or anything in the planner
changes (so ticking an item cancels its reminder, K9). Times are converted to the phone's time
zone when the list is sent. If the app isn't opened for 30 days, repeating reminders run out
until it is (K10).

**Local development:** `pnpm --filter @planner/push dev` runs the service on
`http://localhost:8787` with a local database; build the app against it with
`EXPO_PUBLIC_PUSH_URL=http://localhost:8787 pnpm build:web`. Desktop browsers need a push
service of their own to receive anything; the full path is only end-to-end on a phone.
