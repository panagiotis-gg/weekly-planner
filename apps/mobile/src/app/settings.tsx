import { weekRange } from '@planner/shared';
import Constants from 'expo-constants';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { setDayColor, setWeekStartDay } from '@/data/repositories/planners';
import { disablePush, enablePush, prepareVapidKey, pushStatus, PushStatus, sendTestPush } from '@/features/reminders/push';
import { formatWeekday } from '@/lib/format';
import { useCanEdit, usePlanner, usePlannerId, PlannerGate } from '@/state/planner';
import { Button, Card, Chip, SectionTitle, textStyles } from '@/ui/components';
import { DAY_COLOR_PRESETS, DEFAULT_DAY_COLORS, ThemePreference, usePalette, useThemeStore } from '@/ui/theme';

/** Planner settings (week start A1, day colours Q4) and the device's appearance preference (F3). */
function SettingsContent() {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const planner = usePlanner();
  const canEdit = useCanEdit();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  // A Monday-start sample week gives weekday labels 1..7 for the colour rows.
  const sampleDays = weekRange('2025-06-09', 1).days;

  const themes: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('settings.themeSystem') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card>
        <SectionTitle>{t('settings.weekStart')}</SectionTitle>
        <View style={styles.chips}>
          <Chip label={t('settings.monday')} selected={planner.weekStartDay === 1} onPress={() => canEdit && setWeekStartDay(planner, 1)} />
          <Chip label={t('settings.sunday')} selected={planner.weekStartDay === 7} onPress={() => canEdit && setWeekStartDay(planner, 7)} />
        </View>
      </Card>

      <Card>
        <SectionTitle>{t('settings.theme')}</SectionTitle>
        <View style={styles.chips}>
          {themes.map((th) => (
            <Chip key={th.value} label={th.label} selected={preference === th.value} onPress={() => setPreference(th.value)} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>{t('settings.dayColors')}</SectionTitle>
        {sampleDays.map((date, i) => {
          const weekday = i + 1;
          const current = planner.dayColors[String(weekday) as '1'] ?? DEFAULT_DAY_COLORS[weekday];
          return (
            <View key={date} style={styles.colorRow}>
              <Text style={[text.body, styles.colorLabel]}>{formatWeekday(date)}</Text>
              <View style={styles.swatches}>
                {DAY_COLOR_PRESETS.map((color) => (
                  <Pressable
                    key={color}
                    disabled={!canEdit}
                    onPress={() => setDayColor(planner, weekday, color === DEFAULT_DAY_COLORS[weekday] ? null : color)}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatWeekday(date)} ${color}`}
                    accessibilityState={{ selected: current === color }}
                    style={[
                      styles.swatch,
                      { backgroundColor: color, borderColor: current === color ? p.text : 'transparent' },
                    ]}
                  />
                ))}
              </View>
            </View>
          );
        })}
        {canEdit && Object.keys(planner.dayColors).length > 0 ? (
          <Button
            title={t('settings.resetColors')}
            variant="secondary"
            onPress={() => sampleDays.forEach((_, i) => setDayColor(planner, i + 1, null))}
          />
        ) : null}
      </Card>

      {Platform.OS === 'web' ? <NotificationsCard /> : null}

      {Platform.OS === 'web' ? <TouchDiagnosticsCard /> : null}

      <Text style={[text.muted, styles.footer]}>{t('settings.localOnly')}</Text>
      <Text style={[text.muted, styles.version]}>{versionLabel(t)}</Text>
    </ScrollView>
  );
}

/** App version plus the commit and time of the build (app.config.js), to tell which deploy is running. */
function versionLabel(t: TFunction): string {
  const build = (Constants.expoConfig?.extra?.build ?? {}) as { commit?: string; time?: string };
  const time = build.time ? new Date(build.time) : null;
  return t('settings.version', {
    version: Constants.expoConfig?.version ?? '',
    commit: build.commit ?? 'unknown',
    date: time ? `${time.toLocaleDateString()} ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '',
  });
}

const STATUS_TEXT: Record<PushStatus, string> = {
  unsupported: 'notifications.unsupported',
  'needs-install': 'notifications.needsInstall',
  'not-configured': 'notifications.notConfigured',
  denied: 'notifications.denied',
  off: 'notifications.off',
  on: 'notifications.on',
};

/** Reminder notifications on this device (DECISIONS K3): turn on (asks permission), test, turn off. */
function NotificationsCard() {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const plannerId = usePlannerId();
  const [status, setStatus] = useState<PushStatus>(pushStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Ready before the tap, so "Turn on" can subscribe straight after the permission prompt.
    if (status === 'off') prepareVapidKey().catch(() => undefined);
  }, [status]);

  const act = (action: () => Promise<PushStatus | string>) => {
    setBusy(true);
    setMessage(null);
    action()
      .then((result) => (result in STATUS_TEXT ? setStatus(result as PushStatus) : setMessage(result)))
      .catch(() => setMessage(t('notifications.failed')))
      .finally(() => setBusy(false));
  };

  return (
    <Card>
      <SectionTitle>{t('notifications.title')}</SectionTitle>
      <Text style={text.body}>{t(STATUS_TEXT[status])}</Text>
      {status === 'off' ? (
        <Button title={t('notifications.turnOn')} disabled={busy} onPress={() => act(() => enablePush(plannerId))} />
      ) : null}
      {status === 'on' ? (
        <>
          <Button
            title={t('notifications.test')}
            variant="secondary"
            disabled={busy}
            onPress={() =>
              act(async () =>
                (await sendTestPush(t('notifications.testTitle'), t('notifications.testBody')))
                  ? t('notifications.testSent')
                  : t('notifications.failed'),
              )
            }
          />
          <Button title={t('notifications.turnOff')} variant="secondary" disabled={busy} onPress={() => act(disablePush)} />
        </>
      ) : null}
      {message ? <Text style={text.muted}>{message}</Text> : null}
    </Card>
  );
}

const DIAGNOSTICS_KEY = 'touchDiagnostics';

function readDiagnostics(): boolean {
  try {
    return window.localStorage.getItem(DIAGNOSTICS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Web only: an on-screen log of what the browser reports for each tap (public/index.html), to debug
 * taps that don't register on iPhone Safari. Stored on this device; reloads to take effect.
 */
function TouchDiagnosticsCard() {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const enabled = readDiagnostics();
  const toggle = (on: boolean) => {
    try {
      if (on) window.localStorage.setItem(DIAGNOSTICS_KEY, '1');
      else window.localStorage.removeItem(DIAGNOSTICS_KEY);
    } catch {
      return;
    }
    window.location.reload();
  };
  return (
    <Card>
      <SectionTitle>{t('settings.diagnostics')}</SectionTitle>
      <View style={styles.switchRow}>
        <Text style={[text.body, styles.flex]}>{t('settings.touchDiagnostics')}</Text>
        <Switch value={enabled} onValueChange={toggle} accessibilityLabel={t('settings.touchDiagnostics')} />
      </View>
      <Text style={text.muted}>{t('settings.touchDiagnosticsHint')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  page: { padding: 16, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  colorLabel: { width: 100 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  footer: { textAlign: 'center', marginTop: 8 },
  version: { textAlign: 'center', fontSize: 13 },
});

/** Waits for the local database before rendering (see PlannerGate). */
export default function Settings() {
  return (
    <PlannerGate>
      <SettingsContent />
    </PlannerGate>
  );
}
