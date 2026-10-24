import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { kvGet, kvSet } from '@/data/db/client';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Palette {
  scheme: 'light' | 'dark';
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  onAccent: string;
  danger: string;
  todayRing: string;
  /** Text drawn on top of a day colour. */
  onDayColor: string;
}

const LIGHT: Palette = {
  scheme: 'light',
  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F1ECE4',
  text: '#3A3330',
  textMuted: '#857A72',
  border: '#E4DCD1',
  accent: '#C9846B',
  onAccent: '#FFFFFF',
  danger: '#C0503F',
  todayRing: '#C9846B',
  onDayColor: '#3A3330',
};

const DARK: Palette = {
  scheme: 'dark',
  background: '#1B1917',
  surface: '#252220',
  surfaceMuted: '#2F2B28',
  text: '#F1EAE3',
  textMuted: '#A99E95',
  border: '#3A3532',
  accent: '#E0A188',
  onAccent: '#1B1917',
  danger: '#E57F6E',
  todayRing: '#E0A188',
  onDayColor: '#F6EFE8',
};

/** Pastel header colour per ISO weekday (1 = Monday), as in the reference planner (A9). */
export const DEFAULT_DAY_COLORS: Record<number, string> = {
  1: '#F2C38E',
  2: '#EFA9A1',
  3: '#E89BAE',
  4: '#C9B3E6',
  5: '#A9C8EC',
  6: '#A8D8B9',
  7: '#F3DC8B',
};

/** Choices offered in Settings for per-planner day colours (Q4). */
export const DAY_COLOR_PRESETS = [
  '#F2C38E', '#EFA9A1', '#E89BAE', '#C9B3E6', '#A9C8EC',
  '#A8D8B9', '#F3DC8B', '#D7C4A8', '#B8DCD6', '#F5B8C9',
];

function mix(hex: string, other: string, amount: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex);
  const b = parse(other);
  return `#${a
    .map((v, i) => Math.round(v * (1 - amount) + b[i]! * amount).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Day colour for a weekday: planner override or default, darkened for dark mode. */
export function dayColor(palette: Palette, weekday: number, overrides: Record<string, string | undefined>): string {
  const base = overrides[String(weekday)] ?? DEFAULT_DAY_COLORS[weekday]!;
  return palette.scheme === 'dark' ? mix(base, palette.background, 0.55) : base;
}

// ---- preference store (persisted in the local kv table) ----

const THEME_KEY = 'theme_preference';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  setPreference: (preference) => {
    kvSet(THEME_KEY, preference);
    set({ preference });
  },
}));

export function loadThemePreference(): void {
  const saved = kvGet(THEME_KEY) as ThemePreference | null;
  if (saved) useThemeStore.setState({ preference: saved });
}

export function usePalette(): Palette {
  const system = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return scheme === 'dark' ? DARK : LIGHT;
}
