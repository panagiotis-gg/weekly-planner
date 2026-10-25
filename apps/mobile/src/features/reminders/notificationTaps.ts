import { router } from 'expo-router';
import { Platform } from 'react-native';

/**
 * A tapped reminder notification opens its item's day (DECISIONS K6). When the app is already
 * open, the service worker (public/push-sw.js) asks it to navigate instead of reloading it.
 */
export function listenForNotificationTaps(): () => void {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => undefined;
  const onMessage = (event: MessageEvent<{ type?: string; path?: string }>) => {
    const path = event.data?.path;
    if (event.data?.type === 'open-path' && typeof path === 'string' && path.startsWith('/')) {
      router.push(path as never);
    }
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
