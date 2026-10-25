import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Height of the visual viewport's bottom that the on-screen keyboard covers (web), in px. */
function webKeyboardInset(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

/**
 * How much of the screen's bottom the on-screen keyboard covers, so dialogs and forms can keep
 * their buttons above it. On iPhone Safari (installed web app) the keyboard overlays the page
 * without resizing it; the visual viewport tells how much is hidden. On native, keyboard events.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? window.visualViewport : null;
      if (!vv) return;
      const update = () => setInset(webKeyboardInset());
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      };
    }
    const show = Keyboard.addListener('keyboardDidShow', (e) => setInset(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return inset;
}
