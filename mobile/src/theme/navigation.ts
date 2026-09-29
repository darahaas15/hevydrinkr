import type { Theme as NavigationTheme } from 'expo-router';
import { fonts, type Theme } from '~/theme';

/** React Navigation's theme (headers, sheets, tab content) from our tokens. */
export function navigationTheme({ scheme, colors }: Theme): NavigationTheme {
  return {
    dark: scheme === 'dark',
    colors: {
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.foreground,
      border: colors.chromeBorder,
      notification: colors.red,
    },
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: '400' },
      medium: { fontFamily: fonts.medium, fontWeight: '500' },
      bold: { fontFamily: fonts.bold, fontWeight: '700' },
      heavy: { fontFamily: fonts.extrabold, fontWeight: '800' },
    },
  };
}
