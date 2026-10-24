import '@/i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlannerProvider } from '@/state/planner';
import { usePalette } from '@/ui/theme';

function AppStack() {
  const p = usePalette();
  const { t } = useTranslation();
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
      </PlannerProvider>
    </SafeAreaProvider>
  );
}
