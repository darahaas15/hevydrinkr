import type { ComponentType } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Clock, Droplets, TrendingUp, Wallet, Wine, type LucideIcon } from 'lucide-react-native';
import { useSessionStore } from '@/stores/use-session-store';
import { useDrinkPrefsStore } from '@/stores/use-drink-prefs-store';
import { DRINK_CATEGORY_COLORS, DRINK_CATEGORY_ICONS, SESSION_MOODS } from '@/lib/constants';
import { formatDuration } from '@/lib/utils';
import { formatCost, sumCosts } from '@/lib/money';
import { drinkCategoryBreakdown, uniqueDrinkCount } from '@/lib/session-utils';
import { Button } from '~/components/button';
import { DrinkIcon } from '~/components/drink-icon';
import { Text } from '~/components/text';
import { useTheme, type ColorToken } from '~/theme';

type CategoryIconProps = { size: number; color: string; strokeWidth: number };

/** "Session Complete!" (src/components/session/session-summary.tsx). */
export default function SessionSummaryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSessionStore((s) => (id ? s.getSessionById(id) : undefined));
  const currency = useDrinkPrefsStore((s) => s.currency);

  if (!session) return null;
  const spend = sumCosts(session.drinks);
  const breakdown = drinkCategoryBreakdown(session.drinks);
  const unique = uniqueDrinkCount(session.drinks);
  const moodEmoji = SESSION_MOODS.find((m) => m.value === session.mood)?.emoji ?? '🤢';

  const stats: { icon: LucideIcon; label: string; value: string; tone: ColorToken }[] = [
    { icon: Wine, label: 'Drinks', value: String(session.drinks.length), tone: 'accent' },
    { icon: Clock, label: 'Duration', value: formatDuration(session.durationMinutes), tone: 'infoFg' },
    { icon: Droplets, label: 'Std Drinks', value: session.totalStandardDrinks.toFixed(1), tone: 'violetFg' },
    { icon: TrendingUp, label: 'Types', value: String(unique), tone: 'warningFg' },
    // Only when prices were recorded.
    ...(spend !== null ? [{ icon: Wallet, label: 'Spent', value: formatCost(spend, currency), tone: 'successFg' as const }] : []),
  ];

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <Animated.View entering={ZoomIn.springify().delay(200)}>
        <Text size={60} leading={1.1} style={{ marginBottom: 16 }}>
          {moodEmoji}
        </Text>
      </Animated.View>
      <Text size={24} weight="bold" style={{ marginBottom: 4 }}>
        Session Complete!
      </Text>
      <Text size={14} tone="fgSecondary" style={{ marginBottom: 24 }}>
        {session.venue}
      </Text>

      <View style={styles.grid}>
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const fullWidth = stats.length % 2 === 1 && i === stats.length - 1;
          return (
            <Animated.View
              key={stat.label}
              entering={FadeInDown.delay(300 + i * 100)}
              style={[styles.stat, fullWidth && styles.statFull, { backgroundColor: colors.card, borderColor: colors.hairline }]}
            >
              <Icon size={20} color={colors[stat.tone]} style={{ marginBottom: 8 }} />
              <Text size={24} weight="bold">
                {stat.value}
              </Text>
              <Text size={12} tone="fgSecondary">
                {stat.label}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      <Animated.View entering={FadeIn.delay(600)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
        <Text size={14} weight="medium" tone="fgSecondary" style={{ marginBottom: 12 }}>
          What You Had
        </Text>
        <View style={styles.icons}>
          {session.drinks.map((d) => (
            <DrinkIcon key={d.id} category={d.category} size={20} />
          ))}
        </View>
        <View style={{ gap: 8 }}>
          {breakdown.map(({ category, count }) => {
            const color = DRINK_CATEGORY_COLORS[category] || '#71717a';
            // The plain category icon, as the web summary shows it.
            const Icon = (DRINK_CATEGORY_ICONS[category] || DRINK_CATEGORY_ICONS.custom) as ComponentType<CategoryIconProps>;
            return (
              <View key={category} style={styles.breakdownRow}>
                <Icon size={16} color={color} strokeWidth={1.5} />
                <Text size={14} style={{ flex: 1, textTransform: 'capitalize' }}>
                  {category}
                </Text>
                <Text size={14} mono tone="mutedForeground">
                  {count}
                </Text>
                <View style={[styles.bar, { backgroundColor: colors.surfaceSubtle }]}>
                  <View style={{ width: `${(count / session.drinks.length) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: color }} />
                </View>
              </View>
            );
          })}
        </View>
        <Text size={12} tone="muted" style={{ marginTop: 12 }}>
          {unique} unique drink{unique !== 1 ? 's' : ''} tried
        </Text>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(800)} style={{ alignSelf: 'stretch' }}>
        <Button label="Done" size="lg" textSize={18} textWeight="semibold" onPress={() => router.back()} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignSelf: 'stretch', marginBottom: 24 },
  stat: { width: '47.5%', flexGrow: 1, alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1 },
  statFull: { width: '100%' },
  card: { alignSelf: 'stretch', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { width: 64, height: 6, borderRadius: 999, overflow: 'hidden' },
});
