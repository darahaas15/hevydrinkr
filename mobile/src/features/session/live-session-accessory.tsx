import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ChevronRight, Clock, MapPin, Plus, Wine } from 'lucide-react-native';
import { useSessionStore } from '@/stores/use-session-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useDrinkPrefsStore } from '@/stores/use-drink-prefs-store';
import { useTimer } from '@/hooks/use-timer';
import { hapticLight } from '@/lib/haptics';
import { lastLoggedDrink, relogDrink } from '@/lib/session-actions';
import { DrinkIcon } from '~/components/drink-icon';
import { Text } from '~/components/text';
import { useTheme } from '~/theme';

/**
 * The live-session banner (the web's SessionBanner above the tab bar), in the
 * iOS tab bar's bottom accessory: venue, drink count and timer, tap to open
 * the session, plus one-tap re-logging of the last drink. Collapses to the
 * timer and re-log button when the tab bar minimises.
 */
export function LiveSessionAccessory() {
  const { colors } = useTheme();
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const activeSession = useSessionStore((s) => s.activeSession);
  const userId = useAuthStore((s) => s.currentUser?.id);
  const byUser = useDrinkPrefsStore((s) => s.byUser);
  const lastDrink = useMemo(() => lastLoggedDrink(byUser, userId), [byUser, userId]);
  const timer = useTimer(activeSession?.startedAt ?? null);

  if (!activeSession || !userId) return null;

  const open = () => {
    hapticLight();
    router.navigate('/session');
  };

  const relog = lastDrink ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => relogDrink(userId, lastDrink)}
      accessibilityLabel={`Log another ${lastDrink.name}`}
      hitSlop={6}
      style={({ pressed }) => [
        styles.relog,
        { backgroundColor: pressed ? 'rgba(20, 184, 166, 0.25)' : 'rgba(20, 184, 166, 0.15)' },
      ]}
    >
      <Plus size={14} color={colors.accent} />
      <DrinkIcon category={lastDrink.category} size={16} />
    </Pressable>
  ) : null;

  if (placement === 'inline') {
    return (
      <View style={styles.inline}>
        <Pressable accessibilityRole="button" onPress={open} style={styles.inlineTimer} accessibilityLabel="Open live session">
          <Clock size={14} color={colors.accent} />
          <Text size={12} mono weight="bold" tone="accent">
            {timer.formatted}
          </Text>
        </Pressable>
        {relog}
      </View>
    );
  }

  return (
    <View style={styles.regular}>
      <Pressable accessibilityRole="button" onPress={open} style={styles.summary} accessibilityLabel="Open live session">
        <View style={styles.badge}>
          <Clock size={14} color={colors.accent} />
        </View>
        <View style={styles.details}>
          <Text size={11} weight="semibold" tone="accent" leading={1.3}>
            Live Session
          </Text>
          <View style={styles.meta}>
            <MapPin size={10} color={colors.fgSecondary} />
            <Text size={10} tone="fgSecondary" numberOfLines={1} style={styles.venue}>
              {activeSession.venue}
            </Text>
            <Text size={10} tone="fgFaint">
              ·
            </Text>
            <Wine size={10} color={colors.fgSecondary} />
            <Text size={10} tone="fgSecondary">
              {activeSession.drinks.length}
            </Text>
          </View>
        </View>
        <Text size={12} mono weight="bold" tone="accent">
          {timer.formatted}
        </Text>
        <ChevronRight size={14} color="rgba(20, 184, 166, 0.5)" />
      </Pressable>
      {relog}
    </View>
  );
}

const styles = StyleSheet.create({
  regular: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  summary: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { flex: 1, minWidth: 0 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  venue: { flexShrink: 1 },
  relog: {
    height: 32,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  inline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  inlineTimer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
