import { Fragment, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { FullWindowOverlay } from 'react-native-screens';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { useUIStore } from '@/stores/use-ui-store';
import { hapticSuccess } from '@/lib/haptics';
import { PR_ICONS, PR_LABELS } from '@/types/pr';
import { Button } from '~/components/button';
import { Text } from '~/components/text';
import { useTheme } from '~/theme';

const AUTO_DISMISS_MS = 4000;
const CONFETTI_COLORS = ['#a855f7', '#ec4899', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444'];
const PARTICLE_COUNT = 50;

interface Particle {
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  isCircle: boolean;
}

function randomParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: (Math.random() - 0.5) * 600,
    y: (Math.random() - 0.5) * 600 - 200,
    rotation: Math.random() * 720 - 360,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: Math.random() * 6 + 4,
    isCircle: Math.random() > 0.5,
  }));
}

function ConfettiParticle({ particle, progress }: { particle: Particle; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: particle.x * progress.value },
      { translateY: particle.y * progress.value },
      { rotate: `${particle.rotation * progress.value}deg` },
      { scale: interpolate(progress.value, [0, 1], [1, 0]) },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: particle.size,
          height: particle.size,
          backgroundColor: particle.color,
          borderRadius: particle.isCircle ? particle.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

/** One confetti burst from the centre of the screen (src/components/effects/confetti-burst.tsx). */
function ConfettiBurst() {
  // Mounted fresh for each celebration, so every burst gets its own layout.
  const [particles] = useState(randomParticles);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }));
  }, [progress]);
  return (
    <View style={styles.confetti}>
      {particles.map((particle, i) => (
        <ConfettiParticle key={i} particle={particle} progress={progress} />
      ))}
    </View>
  );
}

/**
 * The new-personal-record celebration the shared session actions trigger
 * (src/components/effects/celebration-modal.tsx). Lives in its own window on
 * iOS so it shows above the session summary sheet.
 */
export function Celebration() {
  const { colors, scheme } = useTheme();
  const show = useUIStore((s) => s.showCelebration);
  const pr = useUIStore((s) => s.celebrationPR);
  const dismiss = useUIStore((s) => s.dismissCelebration);

  useEffect(() => {
    if (!show) return;
    hapticSuccess();
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [show, dismiss]);

  if (!show || !pr) return null;
  const Icon = PR_ICONS[pr.category];
  const Overlay = Platform.OS === 'ios' ? FullWindowOverlay : Fragment;

  return (
    <Overlay>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
        <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Dismiss">
          <BlurView intensity={30} tint={scheme === 'light' ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.8)' }]} />
        </Pressable>
        <ConfettiBurst />
        <View style={styles.center}>
          <Animated.View entering={ZoomIn.springify().damping(18).stiffness(250)} style={styles.card}>
            <Animated.View entering={ZoomIn.springify().delay(100).damping(12)} style={{ marginBottom: 20 }}>
              <Icon size={64} color={colors.accent} />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(150)}>
              <Text size={12} weight="bold" tone="accent" uppercase tracking={1.2} style={{ marginBottom: 8 }}>
                New Personal Record
              </Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(250)}>
              <Text size={18} weight="bold" tone="fgStrong" align="center" style={{ marginBottom: 16 }}>
                {PR_LABELS[pr.category]}
              </Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(350)} style={styles.values}>
              {pr.previousValue !== null && (
                <>
                  <Text size={20} tone="muted" style={{ textDecorationLine: 'line-through' }}>
                    {pr.previousValue}
                  </Text>
                  <Text size={16} tone="fgFaint">
                    →
                  </Text>
                </>
              )}
              <Text size={24} weight="bold">
                {pr.formattedValue}
              </Text>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(450)}>
              <Button label="Nice!" onPress={dismiss} style={{ paddingHorizontal: 32, borderRadius: 16 }} textSize={16} />
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </Overlay>
  );
}

const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create({
  backdrop: FILL,
  confetti: { ...FILL, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  particle: { position: 'absolute' },
  center: { ...FILL, alignItems: 'center', justifyContent: 'center', pointerEvents: 'box-none' },
  card: { alignItems: 'center', paddingHorizontal: 32, maxWidth: 320 },
  values: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
});
