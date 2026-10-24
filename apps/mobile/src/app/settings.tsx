import { weekRange } from '@planner/shared';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { setDayColor, setWeekStartDay } from '@/data/repositories/planners';
import { formatWeekday } from '@/lib/format';
import { useCanEdit, usePlanner, PlannerGate } from '@/state/planner';
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

      <Text style={[text.muted, styles.footer]}>{t('settings.localOnly')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  colorLabel: { width: 100 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  footer: { textAlign: 'center', marginTop: 8 },
});

/** Waits for the local database before rendering (see PlannerGate). */
export default function Settings() {
  return (
    <PlannerGate>
      <SettingsContent />
    </PlannerGate>
  );
}
