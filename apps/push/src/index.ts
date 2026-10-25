import { buildPushPayload, type PushSubscription, type VapidKeys } from '@block65/webcrypto-web-push';

/**
 * Reminder push service (DECISIONS K3, K10).
 *
 * The planner app registers each device's Web Push subscription, then sends the list of its
 * upcoming reminders (time, title, text, where a tap goes) whenever it changes. A cron trigger
 * runs every minute and pushes the ones that are due. Planner data otherwise stays on the device.
 * The push keys (VAPID) are generated on first use and kept in the database.
 */

interface Env {
  DB: D1Database;
  /** The planner web app's address: the only origin allowed to call this service (and its preview subdomains). */
  APP_ORIGIN: string;
}

interface StoredReminder {
  id: string;
  fireAt: number;
  title: string;
  body: string;
  url: string;
}

const MAX_REMINDERS = 500;
const MAX_TEXT = 300;
/** Due reminders sent per cron run; the rest go out a minute later. */
const BATCH = 200;
/** A reminder older than this (e.g. the service was down) is dropped instead of sent late. */
const STALE_MS = 60 * 60 * 1000;
/** How long the push service keeps a message for a phone that's offline. */
const TTL_SECONDS = 60 * 60;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS vapid (id INTEGER PRIMARY KEY CHECK (id = 1), public_key TEXT NOT NULL, private_key TEXT NOT NULL)',
  `CREATE TABLE IF NOT EXISTS devices (
     id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
     created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reminders (
     device_id TEXT NOT NULL, id TEXT NOT NULL, fire_at INTEGER NOT NULL,
     title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL, PRIMARY KEY (device_id, id))`,
  'CREATE INDEX IF NOT EXISTS reminders_due ON reminders (fire_at)',
];

let schemaReady: Promise<void> | null = null;
function ensureSchema(env: Env): Promise<void> {
  schemaReady ??= env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql))).then(() => undefined);
  return schemaReady.catch((err) => {
    schemaReady = null;
    throw err;
  });
}

// ---- encoding helpers ----

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of array) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text: string): Promise<string> {
  return base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

// ---- VAPID keys: created once, kept in D1 ----

async function vapidKeys(env: Env): Promise<{ publicKey: string; privateKey: string }> {
  const row = await env.DB.prepare('SELECT public_key, private_key FROM vapid WHERE id = 1').first<{
    public_key: string;
    private_key: string;
  }>();
  if (row) return { publicKey: row.public_key, privateKey: row.private_key };
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = base64Url((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  const privateKey = ((await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey).d!;
  // Two first requests at once: the first insert wins and both read it back.
  await env.DB.prepare('INSERT OR IGNORE INTO vapid (id, public_key, private_key) VALUES (1, ?, ?)').bind(publicKey, privateKey).run();
  return vapidKeys(env);
}

// ---- HTTP API (called by the planner app) ----

function allowedOrigin(env: Env, origin: string | null): string | null {
  if (!origin) return null;
  const app = new URL(env.APP_ORIGIN);
  const url = new URL(origin);
  // The app itself, its preview deployments (<hash>.<project>.pages.dev) and local development.
  if (url.origin === app.origin || url.hostname.endsWith(`.${app.hostname}`)) return origin;
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return origin;
  return null;
}

function respond(env: Env, request: Request, status: number, body?: unknown): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  const origin = allowedOrigin(env, request.headers.get('origin'));
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('access-control-allow-headers', 'authorization, content-type');
    headers.set('access-control-max-age', '86400');
    headers.set('vary', 'origin');
  }
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

function parseSubscription(value: unknown): PushSubscription | null {
  const s = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!s || typeof s.endpoint !== 'string' || !s.endpoint.startsWith('https://')) return null;
  if (typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') return null;
  return { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}

function parseReminders(value: unknown): StoredReminder[] | null {
  if (!Array.isArray(value) || value.length > MAX_REMINDERS) return null;
  const out: StoredReminder[] = [];
  for (const r of value as Record<string, unknown>[]) {
    const ok =
      typeof r.id === 'string' &&
      r.id.length <= 120 &&
      typeof r.fireAt === 'number' &&
      Number.isFinite(r.fireAt) &&
      typeof r.title === 'string' &&
      typeof r.body === 'string' &&
      typeof r.url === 'string' &&
      r.url.startsWith('/');
    if (!ok) return null;
    out.push({
      id: r.id as string,
      fireAt: Math.trunc(r.fireAt as number),
      title: (r.title as string).slice(0, MAX_TEXT),
      body: (r.body as string).slice(0, MAX_TEXT),
      url: (r.url as string).slice(0, MAX_TEXT),
    });
  }
  return out;
}

/** The device row if the bearer token matches it. */
async function authorizedDevice(env: Env, request: Request, deviceId: string) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const device = await env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first<DeviceRow>();
  return device && device.token_hash === (await sha256(token)) ? device : null;
}

interface DeviceRow {
  id: string;
  token_hash: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function handle(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return respond(env, request, 204);
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const json = async () => {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  // GET /vapid-key: the public key the app subscribes with.
  if (request.method === 'GET' && parts.length === 1 && parts[0] === 'vapid-key') {
    return respond(env, request, 200, { publicKey: (await vapidKeys(env)).publicKey });
  }

  // POST /devices {subscription} → {deviceId, token}
  if (request.method === 'POST' && parts.length === 1 && parts[0] === 'devices') {
    const subscription = parseSubscription((await json())?.subscription);
    if (!subscription) return respond(env, request, 400, { error: 'subscription' });
    const deviceId = crypto.randomUUID();
    const token = randomToken();
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO devices (id, token_hash, endpoint, p256dh, auth, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(deviceId, await sha256(token), subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, now, now)
      .run();
    return respond(env, request, 201, { deviceId, token });
  }

  if (parts[0] !== 'devices' || !parts[1]) return respond(env, request, 404, { error: 'not found' });
  const deviceId = parts[1];
  const device = await authorizedDevice(env, request, deviceId);
  if (!device) return respond(env, request, 401, { error: 'unauthorized' });

  // PUT /devices/:id {subscription}: the browser renewed its subscription.
  if (request.method === 'PUT' && parts.length === 2) {
    const subscription = parseSubscription((await json())?.subscription);
    if (!subscription) return respond(env, request, 400, { error: 'subscription' });
    await env.DB.prepare('UPDATE devices SET endpoint = ?, p256dh = ?, auth = ?, updated_at = ? WHERE id = ?')
      .bind(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, Date.now(), deviceId)
      .run();
    return respond(env, request, 204);
  }

  // PUT /devices/:id/reminders {reminders}: replaces the device's whole list.
  if (request.method === 'PUT' && parts.length === 3 && parts[2] === 'reminders') {
    const reminders = parseReminders((await json())?.reminders);
    if (!reminders) return respond(env, request, 400, { error: 'reminders' });
    const insert = env.DB.prepare(
      'INSERT OR REPLACE INTO reminders (device_id, id, fire_at, title, body, url) VALUES (?, ?, ?, ?, ?, ?)',
    );
    await env.DB.batch([
      env.DB.prepare('DELETE FROM reminders WHERE device_id = ?').bind(deviceId),
      ...reminders.map((r) => insert.bind(deviceId, r.id, r.fireAt, r.title, r.body, r.url)),
    ]);
    return respond(env, request, 204);
  }

  // POST /devices/:id/test {title, body}: a notification right now, to check the setup.
  if (request.method === 'POST' && parts.length === 3 && parts[2] === 'test') {
    const body = await json();
    const status = await send(env, device, {
      id: `test-${Date.now()}`,
      fireAt: Date.now(),
      title: String(body?.title ?? 'Weekly Planner').slice(0, MAX_TEXT),
      body: String(body?.body ?? '').slice(0, MAX_TEXT),
      url: '/',
    });
    return respond(env, request, status < 300 ? 204 : 502, status < 300 ? undefined : { error: 'push', status });
  }

  // DELETE /devices/:id: notifications turned off on this device.
  if (request.method === 'DELETE' && parts.length === 2) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM reminders WHERE device_id = ?').bind(deviceId),
      env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(deviceId),
    ]);
    return respond(env, request, 204);
  }

  return respond(env, request, 404, { error: 'not found' });
}

// ---- sending ----

/** Pushes one reminder; returns the push service's HTTP status. */
async function send(env: Env, device: DeviceRow, reminder: StoredReminder): Promise<number> {
  const keys = await vapidKeys(env);
  const vapid: VapidKeys = { subject: env.APP_ORIGIN, publicKey: keys.publicKey, privateKey: keys.privateKey };
  const subscription: PushSubscription = {
    endpoint: device.endpoint,
    expirationTime: null,
    keys: { p256dh: device.p256dh, auth: device.auth },
  };
  const payload = await buildPushPayload(
    { data: { title: reminder.title, body: reminder.body, url: reminder.url, tag: reminder.id }, options: { ttl: TTL_SECONDS } },
    subscription,
    vapid,
  );
  const res = await fetch(device.endpoint, payload);
  // The subscription is gone (app removed, notifications turned off): forget the device.
  if (res.status === 404 || res.status === 410) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM reminders WHERE device_id = ?').bind(device.id),
      env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(device.id),
    ]);
  }
  return res.status;
}

async function sendDue(env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM reminders WHERE fire_at < ?').bind(now - STALE_MS).run();
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.fire_at, r.title, r.body, r.url, d.id AS device_id, d.token_hash, d.endpoint, d.p256dh, d.auth
     FROM reminders r JOIN devices d ON d.id = r.device_id
     WHERE r.fire_at <= ? ORDER BY r.fire_at LIMIT ?`,
  )
    .bind(now, BATCH)
    .all<{
      id: string;
      fire_at: number;
      title: string;
      body: string;
      url: string;
      device_id: string;
      token_hash: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>();
  await Promise.allSettled(
    results.map(async (r) => {
      const device = { id: r.device_id, token_hash: r.token_hash, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth };
      const status = await send(env, device, { id: r.id, fireAt: r.fire_at, title: r.title, body: r.body, url: r.url });
      // Sent, or rejected for good: done with it. Push-service errors (5xx) are retried next minute.
      if (status < 500) {
        await env.DB.prepare('DELETE FROM reminders WHERE device_id = ? AND id = ?').bind(r.device_id, r.id).run();
      }
    }),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await ensureSchema(env);
    try {
      return await handle(request, env);
    } catch (err) {
      console.error(err);
      return respond(env, request, 500, { error: 'internal' });
    }
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await ensureSchema(env);
    await sendDue(env);
  },
} satisfies ExportedHandler<Env>;
