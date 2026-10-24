import { ReactNode, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Palette, usePalette } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: p.textMuted }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Checkbox({
  checked,
  onToggle,
  disabled,
  label,
}: {
  checked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  label: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled || !onToggle}
      hitSlop={6}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      style={[
        styles.checkbox,
        { borderColor: checked ? p.accent : p.border, backgroundColor: checked ? p.accent : 'transparent' },
        disabled && { opacity: 0.35 },
      ]}
    >
      {checked ? <Text style={[styles.checkmark, { color: p.onAccent }]}>✓</Text> : null}
    </Pressable>
  );
}

/**
 * Tap-to-count pill for items done several times (J6): shows `count/goal` (or just `count`),
 * highlighted once the goal is met. Undo lives in the item's menu.
 */
export function Counter({
  count,
  goal,
  met,
  onAdd,
  label,
  compact,
}: {
  count: number;
  goal: number | null;
  met: boolean;
  onAdd?: () => void;
  label: string;
  compact?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onAdd}
      disabled={!onAdd}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${count}${goal ? ` of ${goal}` : ''}. Add one`}
      style={[
        styles.counter,
        compact && styles.counterCompact,
        { borderColor: met ? p.accent : p.border, backgroundColor: met ? p.accent : 'transparent' },
      ]}
    >
      <Text style={{ color: met ? p.onAccent : count > 0 ? p.text : p.textMuted, fontSize: compact ? 11 : 13, fontVariant: ['tabular-nums'] }}>
        {goal ? `${count}/${goal}` : count}
      </Text>
    </Pressable>
  );
}

/** − value + number input within [min, max]. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const p = usePalette();
  return (
    <View style={styles.stepper} accessibilityLabel={label}>
      <IconButton glyph="−" label={`${label} −1`} onPress={() => onChange(Math.max(min, value - 1))} color={p.text} size={20} />
      <Text style={{ color: p.text, fontSize: 16, minWidth: 28, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <IconButton glyph="+" label={`${label} +1`} onPress={() => onChange(Math.min(max, value + 1))} color={p.text} size={20} />
    </View>
  );
}

/** Whole-number progress (DECISIONS §A); nothing to count shows an empty bar and "–". */
export function ProgressBar({ percent, color }: { percent: number | null; color?: string }) {
  const p = usePalette();
  return (
    <View style={styles.progressRow} accessibilityRole="progressbar" accessibilityValue={{ now: percent ?? 0, min: 0, max: 100 }}>
      <View style={[styles.progressTrack, { backgroundColor: p.surfaceMuted }]}>
        <View style={[styles.progressFill, { width: `${percent ?? 0}%`, backgroundColor: color ?? p.accent }]} />
      </View>
      <Text style={[styles.progressLabel, { color: p.textMuted }]}>{percent === null ? '–' : `${percent}%`}</Text>
    </View>
  );
}

export function IconButton({
  glyph,
  label,
  onPress,
  color,
  size = 18,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
}) {
  const p = usePalette();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={styles.iconButton}>
      <Text style={{ color: color ?? p.textMuted, fontSize: size }}>{glyph}</Text>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const p = usePalette();
  const bg = variant === 'primary' ? p.accent : 'transparent';
  const fg = variant === 'primary' ? p.onAccent : variant === 'danger' ? p.danger : p.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.button, { backgroundColor: bg, borderColor: variant === 'primary' ? bg : p.border }, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { borderColor: selected ? p.accent : p.border, backgroundColor: selected ? p.accent : 'transparent' }]}
    >
      <Text style={{ color: selected ? p.onAccent : p.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  return (
    <TextInput
      placeholderTextColor={p.textMuted}
      {...props}
      style={[styles.field, { color: p.text, borderColor: p.border, backgroundColor: p.surface }, props.style]}
    />
  );
}

/**
 * Text that saves when editing ends (blur or submit), so typing doesn't write on every keystroke.
 * Single-line by default; `multiline` for notes.
 */
export function EditableText({
  value,
  onSave,
  placeholder,
  maxLength,
  multiline,
  editable = true,
  style,
  label,
}: {
  value: string;
  onSave: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  editable?: boolean;
  style?: StyleProp<TextStyle>;
  label: string;
}) {
  const p = usePalette();
  // A draft exists only while editing; otherwise the stored value is shown (and updates live).
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const next = multiline ? draft : draft.replace(/[\r\n]+/g, ' ');
    setDraft(null);
    if (next !== value) onSave(next);
  };
  return (
    <TextInput
      value={draft ?? value}
      onFocus={() => setDraft(value)}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={multiline ? undefined : commit}
      placeholder={placeholder}
      placeholderTextColor={p.textMuted}
      maxLength={maxLength}
      multiline={multiline}
      editable={editable}
      accessibilityLabel={label}
      submitBehavior={multiline ? 'newline' : 'blurAndSubmit'}
      style={[styles.editable, { color: p.text }, multiline && styles.editableMultiline, style]}
    />
  );
}

/** Inline "add" row: type and press enter (or +). */
export function AddRow({ placeholder, onAdd, maxLength }: { placeholder: string; onAdd: (text: string) => void; maxLength: number }) {
  const p = usePalette();
  const [text, setText] = useState('');
  const submit = () => {
    if (text.trim() === '') return;
    onAdd(text);
    setText('');
  };
  return (
    <View style={styles.addRow}>
      <Text style={{ color: p.textMuted, fontSize: 16, width: 22, textAlign: 'center' }}>+</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        submitBehavior="submit"
        placeholder={placeholder}
        placeholderTextColor={p.textMuted}
        maxLength={maxLength}
        accessibilityLabel={placeholder}
        style={[styles.editable, { color: p.text, flex: 1 }]}
      />
    </View>
  );
}

/** Bottom sheet style modal (RN Modal works on native and web). */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]} onPress={() => undefined}>
          <Text style={[styles.sheetTitle, { color: p.text }]}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const textStyles = (p: Palette) =>
  StyleSheet.create({
    body: { color: p.text, fontSize: 15 },
    muted: { color: p.textMuted, fontSize: 13 },
    done: { color: p.textMuted, textDecorationLine: 'line-through' },
  });

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkmark: { fontSize: 13, fontWeight: '800', lineHeight: 15 },
  counter: { minWidth: 40, height: 24, borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  counterCompact: { minWidth: 28, height: 20, paddingHorizontal: 3, borderRadius: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 36, textAlign: 'right' },
  iconButton: { paddingHorizontal: 6, paddingVertical: 2 },
  button: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  field: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  editable: { fontSize: 15, paddingVertical: 4 },
  editableMultiline: { minHeight: 64, textAlignVertical: 'top' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
});
