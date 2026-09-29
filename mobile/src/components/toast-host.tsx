import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { FullWindowOverlay } from 'react-native-screens';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInUp, FadeOutUp, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react-native';
import { useUIStore } from '@/stores/use-ui-store';
import { hapticLight } from '@/lib/haptics';
import { Text } from '~/components/text';
import { useTheme, type ThemeTokens } from '~/theme';

type Toast = ReturnType<typeof useUIStore.getState>['toasts'][number];

const ICONS = { success: CheckCircle, error: AlertCircle, info: Info };

function palette(colors: ThemeTokens, type: Toast['type']) {
  if (type === 'success') return { bg: colors.toastSuccessBg, border: colors.toastSuccessBorder, text: colors.toastSuccessText };
  if (type === 'error') return { bg: colors.toastErrorBg, border: colors.toastErrorBorder, text: colors.toastErrorText };
  return { bg: colors.toastInfoBg, border: colors.toastInfoBorder, text: colors.toastInfoText };
}

function ToastItem({ toast }: { toast: Toast }) {
  const { colors, scheme } = useTheme();
  const removeToast = useUIStore((s) => s.removeToast);
  const tone = palette(colors, toast.type);
  const Icon = ICONS[toast.type] ?? Info;

  // Flick up to dismiss, as on the web.
  const offsetY = useSharedValue(0);
  const dismiss = () => {
    hapticLight();
    removeToast(toast.id);
  };
  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      offsetY.value = Math.min(e.translationY, 0) + Math.max(e.translationY, 0) * 0.3;
    })
    .onEnd((e) => {
      if (e.translationY < -50 || e.velocityY < -300) scheduleOnRN(dismiss);
      else offsetY.value = withSpring(0);
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offsetY.value }] }));

  return (
    // Enter/exit/layout animations and the drag transform live on separate
    // views so the layout animation never overwrites the drag.
    <Animated.View
      entering={FadeInUp.springify().damping(28).stiffness(300)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition.springify()}
    >
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.toast, { borderColor: tone.border }, dragStyle]} accessibilityRole="alert">
          <BlurView intensity={40} tint={scheme === 'light' ? 'systemChromeMaterialLight' : 'systemChromeMaterialDark'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tone.bg }]} />
          <View>
            <Icon size={16} color={tone.text} />
          </View>
          <Text size={13} color={colors.toastFg} style={styles.message}>
            {toast.message}
          </Text>
          {toast.action && (
            <Pressable
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                hapticLight();
                toast.action!.onPress();
                removeToast(toast.id);
              }}
              style={styles.action}
            >
              <Text size={13} weight="semibold" color={tone.text}>
                {toast.action.label}
              </Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={dismiss} hitSlop={8} accessibilityLabel="Dismiss" style={styles.close}>
            <X size={14} color={colors.fgSecondary} />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

/**
 * Renders the shared UI store's toasts at the top of the screen. On iOS it
 * lives in its own window so toasts (and their Undo buttons) stay visible
 * above native sheets. Always mounted, so the last toast can animate out;
 * touches pass through everywhere a toast isn't.
 */
export function ToastHost() {
  const toasts = useUIStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  return (
    <ToastOverlay>
      <View style={[styles.host, { paddingTop: insets.top + 12 }]}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </View>
    </ToastOverlay>
  );
}

// The overlay window must not be modal to VoiceOver (react-native-screens'
// default): it is always mounted, and would otherwise hide the whole app from
// VoiceOver behind an empty window.
function ToastOverlay({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'ios') return <>{children}</>;
  return <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}>{children}</FullWindowOverlay>;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, gap: 8, pointerEvents: 'box-none' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  message: { flex: 1 },
  action: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  close: { padding: 4, marginRight: -4 },
});
