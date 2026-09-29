import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { PressableScale } from '~/components/pressable-scale';
import { Text } from '~/components/text';
import { useTheme } from '~/theme';

/** A failed load with a Retry, as on the web. */
export function ErrorBanner({ message = 'Something went wrong', onRetry }: { message?: string; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.banner}>
      <AlertCircle size={16} color={colors.dangerFg} />
      <Text size={14} tone="dangerFg" style={{ flex: 1 }}>
        {message}
      </Text>
      <PressableScale
        onPress={onRetry}
        style={[styles.retry, { backgroundColor: colors.surfaceRaised }]}
        pressedStyle={{ backgroundColor: colors.surfaceHoverStrong }}
      >
        <View style={styles.retryInner}>
          <RefreshCw size={12} color={colors.fgStrong} />
          <Text size={12} weight="medium" tone="fgStrong">
            Retry
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  retry: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  retryInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
