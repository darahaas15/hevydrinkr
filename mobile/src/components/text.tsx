import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { fonts, useTheme, type ColorToken, type FontWeight } from '~/theme';

// Tailwind's line heights for its named sizes; arbitrary sizes (text-[11px])
// inherit the page's 1.5, so they get the same here.
const LINE_HEIGHT: Record<number, number> = { 12: 16, 14: 20, 16: 24, 18: 28, 20: 28, 24: 32, 30: 36 };

export interface TextProps extends RNTextProps {
  size?: number;
  weight?: FontWeight;
  /** A theme token, e.g. 'fgSecondary'. Ignored when `color` is given. */
  tone?: ColorToken;
  color?: string;
  mono?: boolean;
  /** Line height as a multiple of the size, e.g. 1 for `leading-none`. */
  leading?: number;
  align?: TextStyle['textAlign'];
  uppercase?: boolean;
  tracking?: number;
}

export function Text({
  size = 14,
  weight = 'regular',
  tone = 'foreground',
  color,
  mono,
  leading,
  align,
  uppercase,
  tracking,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const fontFamily = mono ? (weight === 'regular' ? fonts.monoRegular : fonts.monoBold) : fonts[weight];
  const lineHeight = leading !== undefined ? size * leading : LINE_HEIGHT[size] ?? size * 1.5;
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily,
          fontSize: size,
          lineHeight,
          color: color ?? colors[tone],
          textAlign: align,
          textTransform: uppercase ? 'uppercase' : undefined,
          letterSpacing: tracking,
        },
        style,
      ]}
    />
  );
}
