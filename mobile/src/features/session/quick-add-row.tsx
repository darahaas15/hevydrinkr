import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Zap } from 'lucide-react-native';
import type { DrinkEntry } from '@/types';
import { useAuthStore } from '@/stores/use-auth-store';
import {
  entryFromQuickDrink,
  selectCost,
  selectPrefs,
  selectQuickPicks,
  useDrinkPrefsStore,
} from '@/stores/use-drink-prefs-store';
import { formatCost } from '@/lib/money';
import { hapticMedium } from '@/lib/haptics';
import { DrinkIcon } from '~/components/drink-icon';
import { PressableScale } from '~/components/pressable-scale';
import { Text } from '~/components/text';
import { useTheme } from '~/theme';

/**
 * One-tap logging for the drinks you actually order: starred first, then most
 * recent (src/components/session/quick-add-row.tsx).
 */
export function QuickAddRow({ onAdd }: { onAdd: (drink: DrinkEntry) => void }) {
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.currentUser?.id);
  const byUser = useDrinkPrefsStore((s) => s.byUser);
  const currency = useDrinkPrefsStore((s) => s.currency);
  const recordUse = useDrinkPrefsStore((s) => s.recordUse);
  const prefs = useMemo(() => selectPrefs(byUser, userId), [byUser, userId]);
  const picks = useMemo(() => selectQuickPicks(prefs, 6), [prefs]);

  if (picks.length === 0) return null;

  return (
    <View>
      <View style={styles.label}>
        <Zap size={12} color={colors.fgSecondary} />
        <Text size={10} weight="semibold" tone="fgSecondary" uppercase tracking={0.5}>
          Quick add
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.scroller}>
        {picks.map((quick) => {
          const cost = selectCost(prefs, quick.definitionId);
          return (
            <PressableScale
              key={quick.definitionId}
              scaleTo={0.95}
              onPress={() => {
                hapticMedium();
                // Bump recency so the row reorders toward the current order.
                if (userId) recordUse(userId, quick);
                onAdd(entryFromQuickDrink(quick, cost));
              }}
              accessibilityLabel={`Add ${quick.name}`}
              style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.hairline }]}
              pressedStyle={{ backgroundColor: colors.surfaceSubtle }}
            >
              <DrinkIcon category={quick.category} size={16} />
              <Text size={12} weight="medium" numberOfLines={1} style={{ maxWidth: 110 }}>
                {quick.name}
              </Text>
              {cost !== null && (
                <Text size={10} tone="muted">
                  {formatCost(cost, currency)}
                </Text>
              )}
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  scroller: { marginHorizontal: -20 },
  chips: { gap: 6, paddingHorizontal: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
});
