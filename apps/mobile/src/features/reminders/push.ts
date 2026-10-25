import { Platform } from 'react-native';
import { subscribe as onDataChange } from '@/data/changes';
import { kvGet, kvSet } from '@/data/db/client';
import { upcomingNotifications } from './schedule';

/**
 * Web Push for reminders (DECISIONS K3, K10). This device subscribes once, registers with the
 * reminder push service (apps/push), then sends it the list of upcoming reminders whenever the
 * planner changes, when the app opens or comes back to the foreground.
 */

/** The push service's address, set at build time (Cloudflare Pages environment variable). */
const PUSH_URL = (process.env.EXPO_PUBLIC_PUSH_URL ?? '').replace(/\/+$/, '');

const DEVICE_KEY = 'pushDevice';
const SENT_KEY = 'pushSentHash';
const SYNC_DELAY_MS = 1500;

interface Device {
  deviceId: string;
  token: string;
  endpoint: string;
}

export type PushStatus =
  /** Not a browser, or one without notifications. */
  | 'unsupported'
  /** iPhone Safari outside the Home Screen app: it can only notify once installed. */
  | 'needs-install'
  /** This build has no push service address. */
  | 'not-configured'
  | 'denied'
  | 'off'
  | 'on';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

function readDevice(): Device | null {
  const raw = kvGet(DEVICE_KEY);
  return raw ? (JSON.parse(raw) as Device) : null;
}

function writeDevice(device: Device | null): void {
  kvSet(DEVICE_KEY, device ? JSON.stringify(device) : '');
  kvSet(SENT_KEY, '');
}

function isStandalone(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function pushStatus(): PushStatus {
  if (!isWeb) return 'unsupported';
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) return /iPhone|iPad|iPod/.test(navigator.userAgent) && !isStandalone() ? 'needs-install' : 'unsupported';
  if (!PUSH_URL) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && readDevice() ? 'on' : 'off';
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function api(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  return fetch(`${PUSH_URL}${path}`, { ...init, headers });
}

let vapidKey: Promise<string> | null = null;

/** Fetch the service's public key ahead of the tap, so subscribing right after permission is quick. */
export function prepareVapidKey(): Promise<string> {
  vapidKey ??= api('/vapid-key')
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`vapid-key ${res.status}`))))
    .then((body: { publicKey: string }) => body.publicKey)
    .catch((err: unknown) => {
      vapidKey = null;
      throw err;
    });
  return vapidKey;
}

/**
 * Turn notifications on for this device. Must be called from a tap: iPhone only shows the
 * permission prompt for a user action.
 */
export async function enablePush(plannerId: string): Promise<PushStatus> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return pushStatus();
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(await prepareVapidKey()),
    }));
  const res = await api('/devices', { method: 'POST', body: JSON.stringify({ subscription: subscription.toJSON() }) });
  if (!res.ok) throw new Error(`register ${res.status}`);
  const { deviceId, token } = (await res.json()) as { deviceId: string; token: string };
  writeDevice({ deviceId, token, endpoint: subscription.endpoint });
  await syncReminders(plannerId, true);
  return pushStatus();
}

export async function disablePush(): Promise<PushStatus> {
  const device = readDevice();
  const registration = await navigator.serviceWorker.getRegistration();
  await (await registration?.pushManager.getSubscription())?.unsubscribe();
  if (device) await api(`/devices/${device.deviceId}`, { method: 'DELETE', token: device.token }).catch(() => undefined);
  writeDevice(null);
  return pushStatus();
}

/** Sends one notification now, to check that everything works. */
export async function sendTestPush(title: string, body: string): Promise<boolean> {
  const device = readDevice();
  if (!device) return false;
  const res = await api(`/devices/${device.deviceId}/test`, {
    method: 'POST',
    token: device.token,
    body: JSON.stringify({ title, body }),
  });
  return res.ok;
}

/** Short fingerprint of the last list sent, so an unchanged list isn't sent again. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

/** If the browser renewed this device's subscription, tell the service. */
async function refreshSubscription(device: Device): Promise<Device> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription || subscription.endpoint === device.endpoint) return device;
  const res = await api(`/devices/${device.deviceId}`, {
    method: 'PUT',
    token: device.token,
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!res.ok) return device;
  const updated = { ...device, endpoint: subscription.endpoint };
  writeDevice(updated);
  return updated;
}

/** Send the upcoming reminders to the push service if they changed (or `force`). */
export async function syncReminders(plannerId: string, force = false): Promise<void> {
  if (pushStatus() !== 'on') return;
  let device = readDevice();
  if (!device) return;
  device = await refreshSubscription(device);
  const body = JSON.stringify({ reminders: upcomingNotifications(plannerId) });
  const print = fingerprint(body);
  if (!force && kvGet(SENT_KEY) === print) return;
  const res = await api(`/devices/${device.deviceId}/reminders`, { method: 'PUT', token: device.token, body });
  // The service no longer knows this device (e.g. its subscription expired): notifications are off.
  if (res.status === 401) writeDevice(null);
  else if (res.ok) kvSet(SENT_KEY, print);
}

/**
 * Keeps the push service's list current: on start, after every change to the planner (a tick
 * can cancel a reminder, K9), and whenever the app comes back to the foreground (K10).
 */
export function startReminderSync(plannerId: string): () => void {
  if (!isWeb) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    timer = null;
    syncReminders(plannerId).catch((err: unknown) => console.warn('Reminder sync failed', err));
  };
  const soon = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, SYNC_DELAY_MS);
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') soon();
  };
  const unsubscribe = onDataChange(soon);
  document.addEventListener('visibilitychange', onVisible);
  soon();
  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisible);
    if (timer) clearTimeout(timer);
  };
}
