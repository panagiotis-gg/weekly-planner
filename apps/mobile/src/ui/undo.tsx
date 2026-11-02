import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { pressedStyle } from './components';
import { RiseIn } from './motion';
import { usePalette } from './theme';

const VISIBLE_MS = 5000;

interface UndoOffer {
  id: number;
  message: string;
  undo: () => void;
}

/** The current offer, if any; a new one replaces it (DECISIONS L2). */
export const useUndoStore = create<{ offer: UndoOffer | null }>(() => ({ offer: null }));

let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;

function clearOffer(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  useUndoStore.setState({ offer: null });
}

/** Shows the Undo bar for a few seconds after something was deleted or completed. */
export function offerUndo(message: string, undo: () => void): void {
  if (timer) clearTimeout(timer);
  useUndoStore.setState({ offer: { id: nextId++, message, undo } });
  timer = setTimeout(clearOffer, VISIBLE_MS);
}

/** Mounted once, above every screen. */
export function UndoBar() {
  const { t } = useTranslation();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const offer = useUndoStore((s) => s.offer);
  if (!offer) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 16 }]}>
      <RiseIn key={offer.id} style={[styles.bar, { backgroundColor: p.text }]}>
        <Text numberOfLines={1} accessibilityLiveRegion="polite" style={[styles.message, { color: p.background }]}>
          {offer.message}
        </Text>
        <Pressable
          onPress={() => {
            offer.undo();
            clearOffer();
          }}
          accessibilityRole="button"
          hitSlop={10}
          style={({ pressed }) => (pressed ? pressedStyle : undefined)}
        >
          <Text style={[styles.action, { color: p.background }]}>{t('undo.undo')}</Text>
        </Pressable>
      </RiseIn>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 520,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  message: { flex: 1, fontSize: 15 },
  action: { fontSize: 15, fontWeight: '700' },
});
