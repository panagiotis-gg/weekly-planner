import '@/i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { listenForNotificationTaps } from '@/features/reminders/notificationTaps';
import { PlannerProvider } from '@/state/planner';
import { DragLayer } from '@/ui/gestures';
import { usePalette } from '@/ui/theme';
import { UndoBar } from '@/ui/undo';

function AppStack() {
  const p = usePalette();
  const { t } = useTranslation();
  useEffect(() => listenForNotificationTaps(), []);
  return (
    <>
      <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: p.background },
          headerTintColor: p.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: p.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="week/[weekKey]" options={{ title: t('app.title') }} />
        <Stack.Screen name="day/[date]" options={{ title: '' }} />
        <Stack.Screen name="event" options={{ presentation: 'modal', title: t('event.new') }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PlannerProvider>
        <AppStack />
        <UndoBar />
        <DragLayer />
      </PlannerProvider>
    </SafeAreaProvider>
  );
}
