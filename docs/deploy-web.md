# Install on iPhone (web app) — free hosting on Cloudflare Pages

The app is an installable web app (PWA): you open its address in Safari and add it to the
Home Screen. It then has its own icon, opens full-screen, works **offline**, and keeps its
data on the phone. Hosting is free on **Cloudflare Pages**.

## What you need

- A free **Cloudflare account**: https://dash.cloudflare.com/sign-up
- The GitHub repository (already set up): `panagiotis-gg/weekly-planner`
- An iPhone with **iOS 17 or later** (needed for the on-device database in Safari).

## One-time setup (Cloudflare dashboard, about 5 minutes)

1. Sign in to Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorise Cloudflare's GitHub app and pick the repository **weekly-planner**.
3. Build settings:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `pnpm build:web` |
   | Build output directory | `apps/mobile/dist` |
   | Root directory | *(leave empty)* |
   | Environment variable | `NODE_VERSION` = `22` |

4. **Save and Deploy**. After a few minutes you get an address like
   `https://weekly-planner.pages.dev` (the exact name is shown in the dashboard).

From then on, **every push to `main` deploys automatically**.

> If the Cloudflare build fails at the install step, set the build command to
> `npx pnpm@10.34.8 install --frozen-lockfile && npx pnpm@10.34.8 build:web`.

## Install on the iPhone

1. Open the address in **Safari**.
2. Tap **Share** (square with an arrow) → **Add to Home Screen** → **Add**.
3. Open **Weekly Plan** from the Home Screen icon (not from Safari).

The app follows the phone's language (Greek or English) and light/dark mode.

## Good to know

- **Your data lives only on this iPhone**, inside the installed app. It isn't in Safari's
  data, and it isn't on a server (sign-in and sync aren't built yet). **Removing the Home Screen
  icon deletes the data.**
- **Updates:** after a deploy, the app picks up the new version the next time you open it
  (the update downloads in the background; a second launch shows it).
- **Reminder notifications** come through a small push service on Cloudflare; set it up once
  with [deploy-push.md](deploy-push.md), then turn them on in the app's Settings.
- **Not available as a web app:** reading the iPhone's calendar (needs the native app).

## How it works (for developers)

| Piece | File |
|---|---|
| Web build (single-page app) | `apps/mobile/app.json` → `expo.web.output: "single"` |
| Home-screen tags, manifest link, service-worker registration | `apps/mobile/public/index.html` |
| Manifest and icons | `apps/mobile/public/manifest.json`, `apps/mobile/public/icons/` (regenerate: `pnpm --filter @planner/mobile icons`) |
| Offline cache (Workbox, precaches the whole build incl. the SQLite wasm) | `apps/mobile/scripts/build-sw.js` |
| Hosting headers: cross-origin isolation for SQLite (`require-corp`, which Safari supports), caching | `apps/mobile/public/_headers` |
| Test the production build locally (applies `_headers` and the app-route fallback) | `pnpm build:web` then `pnpm --filter @planner/mobile serve:web` → http://localhost:8788 |

Cloudflare Pages serves `index.html` for app routes such as `/week/2026-10-19` automatically,
because the build has no `404.html`.
