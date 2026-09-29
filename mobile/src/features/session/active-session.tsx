import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-screens/experimental';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Clock, MapPin, Plus, X } from 'lucide-react-native';
import { IconSteeringWheel } from '@tabler/icons-react-native';
import { useSessionStore } from '@/stores/use-session-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useUIStore } from '@/stores/use-ui-store';
import { useDrinkPrefsStore } from '@/stores/use-drink-prefs-store';
import { useTimer } from '@/hooks/use-timer';
import { calculateBac, getSafetyColor } from '@/lib/algorithms/bac';
import { BAC_DISCLAIMER, BAC_LEGAL_LIMIT } from '@/lib/constants';
import { formatDuration } from '@/lib/utils';
import { formatCost, sumCosts } from '@/lib/money';
import { averageDrinksPerSession, uniqueDrinkCount } from '@/lib/session-utils';
import { logDrink, removeDrinkWithUndo } from '@/lib/session-actions';
import { hapticLight, hapticWarning } from '@/lib/haptics';
import { HeaderActions } from '~/components/header-actions';
import { PressableScale } from '~/components/pressable-scale';
import { Text } from '~/components/text';
import { confirmAction, promptText } from '~/lib/dialogs';
import { BacGauge } from '~/features/session/bac-gauge';
import { DrinkList } from '~/features/session/drink-list';
import { QuickAddRow } from '~/features/session/quick-add-row';
import { useTheme } from '~/theme';

const NEUTRAL_BAC_COLOR = '#a1a1aa';
const EMPTY_POSTS: never[] = [];

/** The session in progress (the web's active session screen). */
export function ActiveSession() {
  const { colors } = useTheme();
  const activeSession = useSessionStore((s) => s.activeSession);
  const updateVenue = useSessionStore((s) => s.updateVenue);
  const updatePeakBac = useSessionStore((s) => s.updatePeakBac);
  const abandonSession = useSessionStore((s) => s.abandonSession);
  const currentUser = useAuthStore((s) => s.currentUser);
  const myPosts = useFeedStore((s) => (currentUser ? s.userPosts[currentUser.id] : undefined) ?? EMPTY_POSTS);
  const addToast = useUIStore((s) => s.addToast);
  const currency = useDrinkPrefsStore((s) => s.currency);
  const timer = useTimer(activeSession?.startedAt ?? null);
  // Dismissing the drink-limit warning lasts for this session only.
  const [bacWarningDismissedFor, setBacWarningDismissedFor] = useState<string | null>(null);
  const dismissedBacWarning = !!activeSession && bacWarningDismissedFor === activeSession.id;

  const drinks = useMemo(() => activeSession?.drinks ?? [], [activeSession?.drinks]);
  const totalStdDrinks = drinks.reduce((sum, d) => sum + (d?.standardDrinks ?? 0), 0);
  const spend = sumCosts(drinks);
  const avgDrinks = averageDrinksPerSession(myPosts.filter((p) => p.sessionSummary));
  const drinkDiff = drinks.length - avgDrinks;

  // Live BAC estimate, recomputed every second as the timer ticks.
  const bac = useMemo(
    () => (currentUser ? calculateBac(drinks, { weightKg: currentUser.weightKg, gender: currentUser.gender }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drinks, currentUser?.weightKg, currentUser?.gender, timer.elapsed],
  );
  const peakBac = bac?.peakBac;
  useEffect(() => {
    if (peakBac !== undefined && Number.isFinite(peakBac) && peakBac > 0) updatePeakBac(peakBac);
  }, [peakBac, updatePeakBac]);

  if (!activeSession) return null;
  const bacColor = bac ? getSafetyColor(bac.safetyLevel) : NEUTRAL_BAC_COLOR;

  const editVenue = async () => {
    const next = await promptText({ title: 'Venue', defaultValue: activeSession.venue, confirmLabel: 'Save' });
    if (next?.trim()) updateVenue(next.trim());
  };

  const abandon = async () => {
    const confirmed = await confirmAction({
      title: 'Cancel session?',
      message: "This session won't be saved",
      confirmLabel: 'Cancel It',
      cancelLabel: 'Keep Going',
      destructive: true,
    });
    if (!confirmed) return;
    hapticWarning();
    abandonSession();
  };

  const end = () => {
    if (drinks.length === 0) {
      addToast('Add at least one drink first', 'error');
      return;
    }
    router.push('/end-session');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTitle: () => (
            <Pressable accessibilityRole="button" onPress={editVenue} style={styles.title} accessibilityLabel={`Venue: ${activeSession.venue}. Tap to edit`}>
              <View style={styles.titleVenue}>
                <MapPin size={12} color={colors.fgSecondary} />
                <Text size={11} tone="fgSecondary" numberOfLines={1} style={{ maxWidth: 200 }}>
                  {activeSession.venue}
                </Text>
              </View>
              <View style={styles.titleTimer}>
                <Clock size={16} color={colors.accent} />
                <Text size={18} mono weight="bold" leading={1.3}>
                  {timer.formatted}
                </Text>
              </View>
            </Pressable>
          ),
        }}
      />
      <HeaderActions
        menu={{
          label: 'Session options',
          items: [
            { label: 'Edit venue', icon: 'pencil', onPress: editVenue },
            { label: 'Abandon session', icon: 'trash', destructive: true, onPress: abandon },
          ],
        }}
        button={{ label: 'End', onPress: end, tint: colors.red, prominent: true }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {bac && bac.currentBac >= BAC_LEGAL_LIMIT && !dismissedBacWarning && (
          <Animated.View entering={FadeInDown} style={styles.warning} accessibilityRole="alert">
            <IconSteeringWheel size={20} color={colors.dangerFg} strokeWidth={1.75} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={14} weight="semibold" tone="dangerFg">
                Over legal driving limit
              </Text>
              <Text size={11} tone="fgStrong" leading={1.375}>
                Estimated BAC is {bac.currentBac.toFixed(3)}% — do not drive. BAC is an estimate and can be inaccurate; arrange a ride.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setBacWarningDismissedFor(activeSession.id)}
              hitSlop={8}
              accessibilityLabel="Dismiss warning"
            >
              <X size={16} color="rgba(248, 113, 113, 0.6)" />
            </Pressable>
          </Animated.View>
        )}

        <BacGauge standardDrinks={totalStdDrinks} drinks={drinks} />

        {/* Pace & context */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
          <View style={styles.paceTop}>
            <View>
              <Text size={30} weight="extrabold">
                {drinks.length}
              </Text>
              <Text size={11} tone="fgSecondary">
                drinks
              </Text>
            </View>
            <View style={styles.bac}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text size={24} mono weight="bold" color={bacColor}>
                  {bac ? bac.currentBac.toFixed(3) : '0.000'}%
                </Text>
                <Text size={10} tone="muted">
                  est. BAC
                </Text>
              </View>
              <IconSteeringWheel size={28} color={bacColor} strokeWidth={1.5} style={{ marginTop: -16 }} />
            </View>
          </View>

          {bac && bac.currentBac > 0 && (
            <View style={[styles.tiles, { marginBottom: 12 }]}>
              {bac.hoursUntilDriveSafe > 0 && (
                <View style={[styles.tile, styles.driveTile]}>
                  <Text size={14} weight="bold" tone="dangerFg">
                    ~{formatDuration(Math.round(bac.hoursUntilDriveSafe * 60))}
                  </Text>
                  <Text size={10} color="rgba(248, 113, 113, 0.6)">
                    until drive-safe
                  </Text>
                </View>
              )}
              <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.borderFaint }]}>
                <Text size={14} weight="bold">
                  ~{formatDuration(Math.round(bac.hoursUntilSober * 60))}
                </Text>
                <Text size={10} tone="muted">
                  until sober
                </Text>
              </View>
            </View>
          )}

          {drinks.length > 0 && (
            <View style={styles.tiles}>
              {avgDrinks > 0 && (
                <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.borderFaint }]}>
                  <Text size={14} weight="bold" tone={drinkDiff > 0 ? 'accentText' : drinkDiff < 0 ? 'mutedForeground' : 'fgStrong'}>
                    {drinkDiff > 0 ? '+' : ''}
                    {drinkDiff.toFixed(0)}
                  </Text>
                  <Text size={10} tone="muted">
                    vs your avg
                  </Text>
                </View>
              )}
              <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.borderFaint }]}>
                <Text size={14} weight="bold">
                  {uniqueDrinkCount(drinks)}
                </Text>
                <Text size={10} tone="muted">
                  Types
                </Text>
              </View>
              {spend !== null && (
                <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.borderFaint }]}>
                  <Text size={14} weight="bold">
                    {formatCost(spend, currency)}
                  </Text>
                  <Text size={10} tone="muted">
                    Spent
                  </Text>
                </View>
              )}
            </View>
          )}

          <Text size={11} tone="fgSecondary" leading={1.375} style={{ marginTop: 12 }}>
            {BAC_DISCLAIMER}
          </Text>
        </View>

        <QuickAddRow onAdd={logDrink} />
        <DrinkList drinks={drinks} onAdd={logDrink} onRemove={removeDrinkWithUndo} />
      </ScrollView>

      {/* Add drink, docked above the tab bar */}
      <SafeAreaView edges={{ bottom: true }} insetType="all" style={styles.fabDock}>
        <Animated.View entering={ZoomIn.springify().damping(20).stiffness(400).delay(150)}>
          <PressableScale
            scaleTo={0.92}
            onPress={() => {
              hapticLight();
              router.push('/drink-picker');
            }}
            style={[styles.fab, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Add drink"
          >
            <Plus size={24} color={colors.accentForeground} />
          </PressableScale>
        </Animated.View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  title: { alignItems: 'center' },
  titleVenue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleTimer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 16 },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  paceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bac: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  driveTile: { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.15)' },
  fabDock: { position: 'absolute', right: 20, bottom: 12, pointerEvents: 'box-none' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 24px rgba(20, 184, 166, 0.35)',
  },
});
