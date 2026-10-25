import { createElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import i18n from '@/i18n';
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

/**
 * Web: the browser's own date/time input, so iPhone shows its scroll wheels for times and its
 * date picker for dates (DECISIONS K7), with 12/24 h following the phone (F3).
 */
function BrowserInput({ type, value, onChange, label, clearable, min, max }: PickerProps & { type: 'date' | 'time' }) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      {createElement('input', {
        type,
        value: value ?? '',
        min,
        max,
        'aria-label': label,
        // iPhone's picker has its own "Reset", which empties the value: clear it only if allowed.
        onChange: (e: { target: { value: string } }) =>
          e.target.value === '' ? clearable && onChange(null) : onChange(e.target.value),
        style: {
          flex: 1,
          minWidth: 0,
          boxSizing: 'border-box',
          minHeight: 44,
          margin: 0,
          padding: '9px 12px',
          fontSize: 17,
          // react-native-web's System font; the page itself has none to inherit.
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          borderRadius: 10,
          border: `1px solid ${p.border}`,
          color: p.text,
          background: p.surface,
          colorScheme: p.scheme,
          WebkitAppearance: 'none',
          appearance: 'none',
        },
      })}
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
  );
}

export function DateField(props: PickerProps) {
  return <BrowserInput type="date" {...props} />;
}

export function TimeField(props: PickerProps) {
  return <BrowserInput type="time" {...props} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clear: { paddingHorizontal: 6 },
});
