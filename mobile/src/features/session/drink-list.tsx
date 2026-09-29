import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutRight, LinearTransition } from 'react-native-reanimated';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import type { DrinkEntry } from '@/types';
import { groupDrinksByDefinition, latestEntry, repeatDrink, type DrinkGroup } from '@/lib/drink-groups';
import { hapticLight, hapticWarning } from '@/lib/haptics';
import { DrinkIcon } from '~/components/drink-icon';
import { Text } from '~/components/text';
import { useTheme } from '~/theme';

/**
 * The live session's drinks, one row per drink with -/+ and remove-all
 * (src/components/session/drink-list.tsx + drink-cart.tsx).
 */
export function DrinkList({
  drinks,
  onAdd,
  onRemove,
}: {
  drinks: DrinkEntry[];
  onAdd: (drink: DrinkEntry) => void;
  onRemove: (drink: DrinkEntry) => void;
}) {
  const groups = useMemo(() => groupDrinksByDefinition(drinks), [drinks]);

  if (drinks.length === 0) {
    return (
      <View style={styles.empty}>
        <DrinkIcon category="beer" size={40} />
        <Text size={14} tone="fgSecondary" style={{ marginTop: 12 }}>
          No drinks yet
        </Text>
        <Text size={12} tone="muted">
          Tap + to add your first drink
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Text size={14} weight="medium" tone="fgSecondary">
        Drinks ({drinks.length})
      </Text>
      <View style={{ gap: 6 }}>
        {groups.map((group) => (
          <DrinkRow
            key={group.key}
            group={group}
            onInc={() => onAdd(repeatDrink(group.template))}
            onDec={() => onRemove(latestEntry(group))}
            onRemoveAll={() => group.entries.forEach(onRemove)}
          />
        ))}
      </View>
    </View>
  );
}

function DrinkRow({
  group,
  onInc,
  onDec,
  onRemoveAll,
}: {
  group: DrinkGroup;
  onInc: () => void;
  onDec: () => void;
  onRemoveAll: () => void;
}) {
  const { colors } = useTheme();
  const { template, quantity } = group;
  const stepStyle = ({ pressed }: { pressed: boolean }) => [
    styles.step,
    { backgroundColor: pressed ? colors.surfaceHoverStrong : colors.surfaceSubtle },
  ];
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutRight.duration(200)}
      layout={LinearTransition.duration(200)}
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.hairline }]}
    >
      <DrinkIcon category={template.category} size={20} />
      <View style={styles.info}>
        <Text size={14} weight="medium" numberOfLines={1}>
          {template.drinkName}
        </Text>
        <Text size={10} tone="muted">
          {template.abvPercent}% · {template.volumeMl}ml · {(template.standardDrinks * quantity).toFixed(1)} std
        </Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            onDec();
          }}
          style={stepStyle}
          hitSlop={4}
          accessibilityLabel={`Remove one ${template.drinkName}`}
        >
          <Minus size={14} color={colors.mutedForeground} />
        </Pressable>
        <Text size={14} mono weight="bold" align="center" style={styles.quantity}>
          {quantity}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            onInc();
          }}
          style={stepStyle}
          hitSlop={4}
          accessibilityLabel={`Add one ${template.drinkName}`}
        >
          <Plus size={14} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticWarning();
            onRemoveAll();
          }}
          style={({ pressed }) => [styles.step, pressed && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
          hitSlop={4}
          accessibilityLabel={`Remove all ${template.drinkName}`}
        >
          <Trash2 size={14} color={colors.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  info: { flex: 1, minWidth: 0 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  step: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  quantity: { width: 24 },
});
