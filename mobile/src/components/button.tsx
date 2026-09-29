import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '~/components/pressable-scale';
import { Text } from '~/components/text';
import { BRAND_GRADIENT, useTheme, type FontWeight } from '~/theme';

type Variant = 'primary' | 'gradient' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'lg';
  /** Label size when it differs from the size default (lg 15, md 14). */
  textSize?: number;
  textWeight?: FontWeight;
  /** Opacity while disabled (the web varies it per button). */
  disabledOpacity?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** The web app's button recipes: accent fill, brand gradient, quiet surface. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  size = 'md',
  textSize,
  disabledOpacity = 0.3,
  textWeight,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();
  const height = size === 'lg' ? 54 : 46;
  const radius = size === 'lg' ? 16 : 12;
  const fill: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: colors.accent },
    gradient: {},
    secondary: { backgroundColor: colors.surfaceSecondary },
    ghost: { borderWidth: 1, borderColor: colors.chromeBorder },
    danger: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  };
  const textTone = {
    primary: colors.accentForeground,
    gradient: colors.accentForeground,
    secondary: colors.mutedForeground,
    ghost: colors.mutedForeground,
    danger: colors.dangerFg,
  }[variant];
  const bold = variant === 'primary' || variant === 'gradient' || variant === 'danger';

  const content = loading ? (
    <ActivityIndicator color={textTone} />
  ) : (
    <Text size={textSize ?? (size === 'lg' ? 15 : 14)} weight={textWeight ?? (bold ? 'bold' : 'medium')} color={textTone}>
      {label}
    </Text>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        { height, borderRadius: radius, overflow: 'hidden', opacity: disabled ? disabledOpacity : 1 },
        fill[variant],
        style,
      ]}
    >
      {variant === 'gradient' ? (
        <LinearGradient
          colors={BRAND_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{content}</View>
      )}
    </PressableScale>
  );
}
