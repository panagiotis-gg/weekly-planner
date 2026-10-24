import { NO_TARGET, Target, TARGET_LIMITS, TargetType } from '@planner/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Chip, Stepper, textStyles } from '@/ui/components';
import { usePalette } from '@/ui/theme';

const TYPES: (TargetType | null)[] = [null, 'days_per_week', 'times_per_week', 'times_per_day', 'times_per_day_on_days'];
const TYPE_LABEL: Record<string, string> = {
  none: 'target.none',
  days_per_week: 'target.daysPerWeek',
  times_per_week: 'target.timesPerWeek',
  times_per_day: 'target.timesPerDay',
  times_per_day_on_days: 'target.timesPerDayOnDays',
};

/** Sensible starting numbers when switching type, kept within `maxDays`. */
function defaultsFor(type: TargetType | null, maxDays: number, previous: Target): Target {
  const days = Math.min(previous.daysPerWeek ?? 3, maxDays);
  const perDay = previous.perDay ?? 2;
  switch (type) {
    case 'days_per_week':
      return { targetType: type, perDay: null, daysPerWeek: days, timesPerWeek: null };
    case 'times_per_week':
      return { targetType: type, perDay: null, daysPerWeek: null, timesPerWeek: previous.timesPerWeek ?? 5 };
    case 'times_per_day':
      return { targetType: type, perDay, daysPerWeek: null, timesPerWeek: null };
    case 'times_per_day_on_days':
      return { targetType: type, perDay, daysPerWeek: days, timesPerWeek: null };
    default:
      return NO_TARGET;
  }
}

/**
 * Pick a target type and its numbers (DECISIONS J2/J3, limits J12).
 * `maxDays` is how many days can count (a habit's selected days, or 7 for a weekly to-do).
 */
export function TargetEditor({ value, onChange, maxDays }: { value: Target; onChange: (t: Target) => void; maxDays: number }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const set = (patch: Partial<Target>) => onChange({ ...value, ...patch });

  return (
    <View style={styles.wrap}>
      <Text style={text.muted}>{t('target.title')}</Text>
      <View style={styles.chips}>
        {TYPES.map((type) => (
          <Chip
            key={type ?? 'none'}
            label={t(TYPE_LABEL[type ?? 'none']!)}
            selected={value.targetType === type}
            onPress={() => onChange(defaultsFor(type, maxDays, value))}
          />
        ))}
      </View>
      {value.perDay !== null ? (
        <View style={styles.row}>
          <Text style={[text.body, styles.label]}>{t('target.timesEachDay')}</Text>
          <Stepper
            label={t('target.timesEachDay')}
            value={value.perDay}
            min={TARGET_LIMITS.perDay.min}
            max={TARGET_LIMITS.perDay.max}
            onChange={(perDay) => set({ perDay })}
          />
        </View>
      ) : null}
      {value.daysPerWeek !== null ? (
        <View style={styles.row}>
          <Text style={[text.body, styles.label]}>{t('target.daysAWeek')}</Text>
          <Stepper
            label={t('target.daysAWeek')}
            value={Math.min(value.daysPerWeek, maxDays)}
            min={TARGET_LIMITS.daysPerWeek.min}
            max={Math.max(1, maxDays)}
            onChange={(daysPerWeek) => set({ daysPerWeek })}
          />
        </View>
      ) : null}
      {value.timesPerWeek !== null ? (
        <View style={styles.row}>
          <Text style={[text.body, styles.label]}>{t('target.timesAWeek')}</Text>
          <Stepper
            label={t('target.timesAWeek')}
            value={value.timesPerWeek}
            min={TARGET_LIMITS.timesPerWeek.min}
            max={TARGET_LIMITS.timesPerWeek.max}
            onChange={(timesPerWeek) => set({ timesPerWeek })}
          />
        </View>
      ) : null}
      {value.targetType ? <Text style={text.muted}>{t(`target.hint.${value.targetType}`)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flex: 1 },
});
