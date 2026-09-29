import { Stack } from 'expo-router';
import { Wordmark } from '~/components/wordmark';
import { useTheme } from '~/theme';

export default function FeedStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerTitle: () => <Wordmark size={20} /> }} />
    </Stack>
  );
}
