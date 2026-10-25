import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { IsoDate, makeDate } from '@planner/shared';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import i18n from '@/i18n';
import { formatFullDate, formatTime } from '@/lib/format';
import { usePalette } from './theme';

/** A date ("YYYY-MM-DD") or time ("HH:mm") value; null when an optional one is empty. */
export type PickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  /** Optional values get a × to clear them. */
  clearable?: boolean;
  min?: string;
  max?: string;
};

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(mode: 'date' | 'time', value: string | null): Date {
  if (mode === 'date' && value) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  }
  if (mode === 'time' && value) {
    const [h, min] = value.split(':').map(Number);
    return new Date(2000, 0, 1, h!, min!);
  }
  return new Date();
}

function fromDate(mode: 'date' | 'time', date: Date): string {
  return mode === 'date'
    ? makeDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Native: the platform picker (iOS wheels / calendar, Android dialogs), opened from a field-like button (K7). */
function NativePicker({ mode, value, onChange, label, clearable, min, max }: PickerProps & { mode: 'date' | 'time' }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const shown = value ? (mode === 'date' ? formatFullDate(value as IsoDate) : formatTime(value)) : '—';
  const handle = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && picked) onChange(fromDate(mode, picked));
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown}`}
          style={[styles.field, { borderColor: p.border, backgroundColor: p.surface }]}
        >
          <Text style={{ color: value ? p.text : p.textMuted, fontSize: 17 }}>{shown}</Text>
        </Pressable>
        {clearable && value ? (
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel={`${i18n.t('common.clear')}: ${label}`}
            hitSlop={8}
            style={styles.clear}
          >
            <Text style={{ color: p.textMuted, fontSize: 20 }}>×</Text>
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <DateTimePicker
          value={toDate(mode, value)}
          mode={mode}
          display={Platform.OS === 'ios' ? (mode === 'time' ? 'spinner' : 'inline') : 'default'}
          minimumDate={min ? toDate('date', min) : undefined}
          maximumDate={max ? toDate('date', max) : undefined}
          onChange={handle}
        />
      ) : null}
    </View>
  );
}

export function DateField(props: PickerProps) {
  return <NativePicker mode="date" {...props} />;
}

export function TimeField(props: PickerProps) {
  return <NativePicker mode="time" {...props} />;
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  clear: { paddingHorizontal: 6 },
});
