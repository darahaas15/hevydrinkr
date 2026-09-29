import { darkTokens, lightTokens, type ThemeTokens } from './tokens.generated';
import { useThemeStore, type ThemePreference } from './theme-store';

export type { ThemeTokens, ThemePreference };
export type ColorToken = keyof ThemeTokens;

export interface Theme {
  scheme: ThemePreference;
  colors: ThemeTokens;
}

export function themeFor(scheme: ThemePreference): Theme {
  return { scheme, colors: scheme === 'light' ? lightTokens : darkTokens };
}

export function useTheme(): Theme {
  return themeFor(useThemeStore((s) => s.preference));
}

/** The `--gauge-N` intoxication colours, by level. */
export function gaugeColor(colors: ThemeTokens, level: 1 | 2 | 3 | 4 | 5): string {
  return [colors.gauge1, colors.gauge2, colors.gauge3, colors.gauge4, colors.gauge5][level - 1];
}

/** Geist, the web app's typeface, one family per weight. */
export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  extrabold: 'Geist_800ExtraBold',
  monoRegular: 'GeistMono_400Regular',
  monoBold: 'GeistMono_700Bold',
} as const;

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

/** The brand gradient behind the wordmark and primary auth buttons. */
export const BRAND_GRADIENT = ['#14b8a6', '#0ea5e9'] as const;
