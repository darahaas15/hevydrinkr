// Web-preview stand-in (`npm run web`): Stack.Toolbar only renders on iOS and
// Android, so the same actions become plain header buttons here.
import { Pressable, View } from 'react-native';
import { Stack } from 'expo-router';
import { Text } from '~/components/text';
import { useTheme } from '~/theme';
import type { HeaderActionsProps } from './header-actions';

export function HeaderActions({ menu, button }: HeaderActionsProps) {
  const { colors } = useTheme();
  return (
    <Stack.Screen
      options={{
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 16 }}>
            {menu?.items.map((item) => (
              <Pressable key={item.label} onPress={item.onPress} accessibilityRole="button">
                <Text size={14} color={item.destructive ? colors.dangerFg : colors.mutedForeground}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
            {button && (
              <Pressable onPress={button.onPress} accessibilityRole="button">
                <Text size={14} weight="semibold" color={button.tint ?? colors.accent}>
                  {button.label}
                </Text>
              </Pressable>
            )}
          </View>
        ),
      }}
    />
  );
}
