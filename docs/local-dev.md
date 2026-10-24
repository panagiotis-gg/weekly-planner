# Local Development

The backend (API, worker, PostgreSQL, Redis, Mailpit) runs in Docker. The mobile app runs on
the host with Expo, because it has to talk to simulators, emulators and physical devices.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker Desktop (or Docker Engine + Compose v2) | Compose ≥ 2.22 | `docker compose watch` is required |
| Node.js | 22 LTS | Only needed on the host for the mobile app and editor tooling |
| pnpm | via Corepack | `corepack enable` (ships with Node 22) |
| Xcode / Android Studio | current | For iOS simulator / Android emulator dev builds |

## First run

```bash
cp .env.example .env
```

```bash
corepack enable
```

```bash
pnpm install
```

```bash
docker compose watch
```

`docker compose watch` builds the `dev` image, starts the whole stack and keeps
`apps/api/src` and `packages/shared/src` synced into the containers. The NestJS watcher reloads
on every save. Changes to `package.json` or `pnpm-lock.yaml` trigger an image rebuild.
The API runs database migrations on start-up.

| Service | URL |
|---|---|
| API | http://localhost:3000/v1 |
| OpenAPI / Swagger UI (dev only) | http://localhost:3000/v1/docs |
| Health | http://localhost:3000/healthz · http://localhost:3000/readyz |
| Mailpit (all outgoing email) | http://localhost:8025 |
| PostgreSQL | `localhost:5432`, user/password/db `planner` |
| Redis | `localhost:6379` |

**Port already in use?** If another project already publishes 3000, 5432, 6379, 8025 or 1025,
set `API_HOST_PORT`, `POSTGRES_PORT`, `REDIS_PORT`, `MAILPIT_UI_PORT` or `MAILPIT_SMTP_PORT` in
`.env` (for example `API_HOST_PORT=3010`, `POSTGRES_PORT=5433`). Only the host side changes;
inside Docker the services keep their usual ports.

### Infrastructure only (run the API on the host)

```bash
docker compose up -d postgres redis mailpit
```

Then, in `.env`, change the hostnames `postgres`, `redis` and `mailpit` to `localhost` and run
`pnpm --filter @planner/api dev`.

## Mobile app

### Install on iPhone

See [deploy-web.md](deploy-web.md): free hosting on Cloudflare Pages, then **Add to Home Screen** in Safari.

### In your laptop's browser (quickest way to review)

```bash
pnpm --filter @planner/mobile web
```

Open http://localhost:8081. Windows ≥ 768 px wide get the multi-column week; narrow windows
get the phone layout (Week screen + swipeable day pager).

- The first load after starting takes a while, because Metro builds the web bundle on demand.
- Data is stored in the browser (SQLite in OPFS), separately per browser.
- Use **one tab** per browser: the database file can only be open in one tab at a time.
- Phone-only features (notifications, phone calendar import, Apple/Google sign-in) don't work on web.

### On a device or emulator

```bash
pnpm --filter @planner/mobile start
```

- Set the API address in `apps/mobile/.env`: `EXPO_PUBLIC_API_URL=http://<host>:3000/v1`
  - iOS simulator: `http://localhost:3000/v1`
  - Android emulator: `http://10.0.2.2:3000/v1`
  - Physical device: your computer's LAN IP, e.g. `http://192.168.1.20:3000/v1`
- Sign in with Apple, Google sign-in, notifications and calendar access need a **development
  build** (`pnpm --filter @planner/mobile run ios` / `run android`), not Expo Go.
- To try offline mode, stop the API (`docker compose stop api`) and keep using the app; changes
  sync after `docker compose start api`.

## Everyday commands

```bash
docker compose logs -f api worker
```

```bash
docker compose exec api pnpm --filter @planner/api admin:grant you@example.com
```

```bash
docker compose exec postgres psql -U planner -d planner
```

```bash
pnpm turbo run test
```

```bash
docker compose down
```

Use `docker compose down -v` to also delete the database and Redis volumes (all local data).

## Tests

- **Unit tests**: `pnpm turbo run test`. Covers shared (recurrence, week math, merge, progress), the API and mobile.
- **Integration tests**: `pnpm --filter @planner/api test:integration`. Starts a throwaway
  PostgreSQL with Testcontainers (Docker must be running), independent of the compose database.

## Production-style run

`docker-compose.prod.yml` builds the slim `runtime` image, with no watch mode and no Mailpit.
Put real secrets and an external SMTP provider in `.env.production` and put a TLS-terminating
load balancer in front of `api`. See the header of that file for the commands.
