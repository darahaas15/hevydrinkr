import { forwardRef, useState, type ReactElement } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { fonts, useTheme } from '~/theme';

interface TextFieldProps extends TextInputProps {
  /** Leading icon; rendered with the muted colour, accent while focused. */
  icon?: (color: string) => ReactElement;
  containerStyle?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
}

/** The web app's input recipe: card fill, hairline border, accent on focus. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { icon, containerStyle, size = 'md', style, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const large = size === 'lg';
  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: large ? colors.surfaceSecondary : colors.card,
          borderColor: focused ? 'rgba(20, 184, 166, 0.3)' : colors.cardBorder,
          borderRadius: large ? 16 : 12,
          minHeight: large ? 58 : 46,
          paddingLeft: icon ? (large ? 48 : 40) : 16,
        },
        containerStyle,
      ]}
    >
      {icon && (
        <View style={[styles.icon, { left: large ? 16 : 14 }]}>
          {icon(focused ? colors.accent : colors.muted)}
        </View>
      )}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        keyboardAppearance="default"
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, { color: colors.foreground, fontSize: large ? 16 : 14 }, style]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  field: { justifyContent: 'center', borderWidth: 1, paddingRight: 16 },
  icon: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center', pointerEvents: 'none' },
  input: { fontFamily: fonts.regular, paddingVertical: 12 },
});
