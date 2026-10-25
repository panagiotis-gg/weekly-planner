import { joinOffset, REMINDER_PRESETS, ReminderUnit, splitOffset } from '@planner/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import i18n from '@/i18n';
import { Button, Chip, Field, textStyles } from '@/ui/components';
import { usePalette } from '@/ui/theme';

const UNITS: ReminderUnit[] = ['minutes', 'hours', 'days'];
const PRESET_KEYS: Record<number, string> = { 0: 'reminder.atTime', 60: 'reminder.hourBefore', 1440: 'reminder.dayBefore' };
const MAX_AMOUNT = 999;

/** "At the time", "1 hour before", or a custom offset such as "90 minutes before". */
export function reminderLabel(offsetMinutes: number): string {
  const preset = PRESET_KEYS[offsetMinutes];
  if (preset) return i18n.t(preset);
  const { amount, unit } = splitOffset(offsetMinutes);
  const key = unit === 'days' ? 'reminder.beforeDays' : unit === 'hours' ? 'reminder.beforeHours' : 'reminder.beforeMinutes';
  return i18n.t(key, { count: amount });
}

/**
 * Reminder choices for an item (DECISIONS K2): presets at the time / 1 hour / 1 day before, plus
 * any custom amount before. Several at once. `value` holds offsets in minutes.
 */
export function ReminderPicker({
  value,
  onChange,
  hint,
  disabledHint,
}: {
  value: number[];
  onChange: (offsets: number[]) => void;
  /** Shown under the choices, e.g. that items without a time count from 09:00. */
  hint?: string;
  /** When set, reminders can't be chosen yet and this explains why. */
  disabledHint?: string;
}) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<ReminderUnit>('minutes');

  const toggle = (offset: number) =>
    onChange(value.includes(offset) ? value.filter((o) => o !== offset) : [...value, offset].sort((a, b) => a - b));
  const custom = value.filter((o) => !(REMINDER_PRESETS as readonly number[]).includes(o));
  const parsed = Number(amount);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_AMOUNT;

  const addCustom = () => {
    if (!valid) return;
    const offset = joinOffset(parsed, unit);
    if (!value.includes(offset)) onChange([...value, offset].sort((a, b) => a - b));
    setAdding(false);
    setAmount('');
  };

  return (
    <View style={styles.wrap}>
      <Text style={text.muted}>{t('reminder.title')}</Text>
      {disabledHint ? (
        <Text style={text.muted}>{disabledHint}</Text>
      ) : (
        <>
          <View style={styles.chips}>
            {REMINDER_PRESETS.map((offset) => (
              <Chip key={offset} label={reminderLabel(offset)} selected={value.includes(offset)} onPress={() => toggle(offset)} />
            ))}
            {custom.map((offset) => (
              <Chip key={offset} label={`${reminderLabel(offset)}  ×`} selected onPress={() => toggle(offset)} />
            ))}
            {!adding ? <Chip label={t('reminder.custom')} selected={false} onPress={() => setAdding(true)} /> : null}
          </View>
          {adding ? (
            <View style={styles.custom}>
              <View style={styles.row}>
                <Field
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/\D/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                  autoFocus
                  style={styles.amount}
                  accessibilityLabel={t('reminder.amount')}
                />
                <View style={styles.chips}>
                  {UNITS.map((u) => (
                    <Chip key={u} label={t(`reminder.${u}`)} selected={unit === u} onPress={() => setUnit(u)} />
                  ))}
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button title={t('common.add')} onPress={addCustom} disabled={!valid} />
                </View>
                <View style={styles.flex}>
                  <Button title={t('common.cancel')} variant="secondary" onPress={() => setAdding(false)} />
                </View>
              </View>
            </View>
          ) : null}
          {hint ? <Text style={text.muted}>{hint}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flexShrink: 1 },
  custom: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { width: 70, textAlign: 'center' },
  flex: { flex: 1 },
});
