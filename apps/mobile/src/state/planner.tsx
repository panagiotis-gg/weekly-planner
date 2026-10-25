import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLiveQuery } from '@/data/changes';
import { initDb } from '@/data/db/client';
import { OtherTabError } from '@/data/db/webDb';
import { startReminderSync } from '@/features/reminders/push';
import { ensureLocalPlanner, getPlanner, LocalPlanner } from '@/data/repositories/planners';
import i18n from '@/i18n';
import { IsoDate, isoWeekday } from '@planner/shared';
import { dayColor, loadThemePreference, usePalette } from '@/ui/theme';

type Boot = { status: 'loading' } | { status: 'ready'; plannerId: string } | { status: 'error'; message: string };

const BootContext = createContext<Boot>({ status: 'loading' });

/**
 * Opens the local DB, runs migrations and picks the active planner.
 * It always renders its children: Expo Router needs the navigator mounted from the first
 * render to resolve deep links (otherwise it falls back to the index route). Screens wait for
 * the database through <PlannerGate>.
 */
export function PlannerProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let stopSync = () => {};
    initDb()
      .then(() => {
        loadThemePreference();
        const plannerId = ensureLocalPlanner();
        if (cancelled) return;
        setBoot({ status: 'ready', plannerId });
        // Keep the reminder push service's list current (DECISIONS K10).
        stopSync = startReminderSync(plannerId);
      })
      .catch((err: unknown) => {
        const raw = err instanceof Error ? err.message : String(err);
        // On web the planner can be open in only one tab (webDb.ts); older storage also locked per tab.
        const message =
          err instanceof OtherTabError || /AccessHandle|createSyncAccessHandle/.test(raw) ? i18n.t('errors.otherTab') : raw;
        if (!cancelled) setBoot({ status: 'error', message });
      });
    return () => {
      cancelled = true;
      stopSync();
    };
  }, []);

  return <BootContext.Provider value={boot}>{children}</BootContext.Provider>;
}

/** Renders a screen's content once the local database is ready; a spinner or error before that. */
export function PlannerGate({ children }: { children: ReactNode }) {
  const p = usePalette();
  const boot = useContext(BootContext);
  if (boot.status === 'ready') return <>{children}</>;
  return (
    <View style={[styles.center, { backgroundColor: p.background }]}>
      {boot.status === 'loading' ? (
        <ActivityIndicator color={p.accent} />
      ) : (
        <Text style={{ color: p.danger, textAlign: 'center' }}>{boot.message}</Text>
      )}
    </View>
  );
}

export function usePlannerId(): string {
  const boot = useContext(BootContext);
  if (boot.status !== 'ready') throw new Error('usePlannerId outside a ready PlannerGate');
  return boot.plannerId;
}

/** The active planner's settings (week start, day colours), live. */
export function usePlanner(): LocalPlanner {
  const id = usePlannerId();
  return useLiveQuery(() => getPlanner(id));
}

/** Colour of a date's weekday (planner override or default pastel, darker in dark mode). */
export function useDayColorFor(): (date: IsoDate) => string {
  const p = usePalette();
  const planner = usePlanner();
  return (date) => dayColor(p, isoWeekday(date), planner.dayColors);
}

/** Viewers see household planners read-only (C3); the local personal planner is always editable. */
export function useCanEdit(): boolean {
  return usePlanner().role !== 'viewer';
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
