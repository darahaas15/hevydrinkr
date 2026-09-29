import { Stack } from 'expo-router';
import { fonts, useTheme } from '~/theme';

export default function ProfileStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeTitleStyle: { fontFamily: fonts.extrabold },
        headerTitleStyle: { fontFamily: fonts.bold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Profile', headerLargeTitle: true }} />
    </Stack>
  );
}
