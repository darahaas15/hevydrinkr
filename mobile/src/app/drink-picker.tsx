import { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Clock, Plus, Search, Star, X } from 'lucide-react-native';
import type { DrinkDefinition } from '@/types';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import {
  quickDrinkFromEntry,
  selectCost,
  selectFavorites,
  selectPrefs,
  selectRecents,
  useDrinkPrefsStore,
} from '@/stores/use-drink-prefs-store';
import {
  PICKER_CATEGORIES,
  buildDefinitionIndex,
  customDrinkToDefinition,
  entryFromCustomDrink,
  entryFromDefinition,
  fetchCustomDrinks,
  filterPickerDrinks,
  resolveQuickDrink,
  saveCustomDrink,
  validateCustomDrink,
  type PickerCategory,
} from '@/lib/drink-picker';
import { logDrink } from '@/lib/session-actions';
import { DRINK_CATEGORY_COLORS } from '@/lib/constants';
import { calculateStandardDrinks } from '@/lib/utils';
import { MAX_DRINK_COST, currencySymbol, formatCost, parseCost } from '@/lib/money';
import { hapticLight, hapticMedium, hapticSelection } from '@/lib/haptics';
import { Button } from '~/components/button';
import { DrinkIcon } from '~/components/drink-icon';
import { PressableScale } from '~/components/pressable-scale';
import { Text } from '~/components/text';
import { TextField } from '~/components/text-field';
import { promptText } from '~/lib/dialogs';
import { useTheme } from '~/theme';

/** Add a drink to the live session (src/components/session/drink-picker.tsx). */
export default function DrinkPickerScreen() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [customDrinks, setCustomDrinks] = useState<DrinkDefinition[]>([]);
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    fetchCustomDrinks(currentUser.id).then((drinks) => {
      if (drinks) setCustomDrinks(drinks);
    });
  }, [currentUser]);

  const pick = (entry: ReturnType<typeof entryFromDefinition>) => {
    if (currentUser) useDrinkPrefsStore.getState().recordUse(currentUser.id, quickDrinkFromEntry(entry));
    logDrink(entry);
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      {showCustom ? (
        <CustomDrinkForm
          onBack={() => setShowCustom(false)}
          onCreated={(definition, entry) => {
            if (definition) setCustomDrinks((prev) => [definition, ...prev]);
            pick(entry);
          }}
        />
      ) : (
        <DrinkList customDrinks={customDrinks} onCustom={() => setShowCustom(true)} onPick={pick} />
      )}
    </KeyboardAvoidingView>
  );
}

function DrinkList({
  customDrinks,
  onCustom,
  onPick,
}: {
  customDrinks: DrinkDefinition[];
  onCustom: () => void;
  onPick: (entry: ReturnType<typeof entryFromDefinition>) => void;
}) {
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.currentUser?.id);
  const addToast = useUIStore((s) => s.addToast);
  const prefsByUser = useDrinkPrefsStore((s) => s.byUser);
  const currency = useDrinkPrefsStore((s) => s.currency);
  const toggleFavorite = useDrinkPrefsStore((s) => s.toggleFavorite);
  const setStoredCost = useDrinkPrefsStore((s) => s.setCost);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PickerCategory>('all');

  const prefs = useMemo(() => selectPrefs(prefsByUser, userId), [prefsByUser, userId]);
  const recentDrinks = useMemo(() => selectRecents(prefs, 8), [prefs]);
  const favoriteDrinks = useMemo(() => selectFavorites(prefs), [prefs]);
  const favoriteIds = useMemo(() => new Set(prefs.favoriteIds), [prefs.favoriteIds]);
  const definitionById = useMemo(() => buildDefinitionIndex(customDrinks), [customDrinks]);
  const drinks = useMemo(
    () =>
      filterPickerDrinks({
        query,
        category,
        customDrinks,
        favorites: favoriteDrinks.map((q) => resolveQuickDrink(q, definitionById)),
      }),
    [query, category, customDrinks, favoriteDrinks, definitionById],
  );
  // The Recent strip is for the unfiltered default view only.
  const showRecents = !query.trim() && category === 'all' && recentDrinks.length > 0;

  const select = (def: DrinkDefinition) => {
    hapticMedium();
    onPick(entryFromDefinition(def, selectCost(prefs, def.id)));
  };

  const editPrice = async (def: DrinkDefinition) => {
    if (!userId) return;
    hapticLight();
    const existing = selectCost(prefs, def.id);
    const input = await promptText({
      title: 'Price per drink',
      message: `${def.name}\nRemembered on this device and attached automatically next time.`,
      defaultValue: existing === null ? '' : String(existing),
      keyboardType: 'decimal-pad',
      clearLabel: existing === null ? undefined : 'Clear price',
    });
    if (input === null) return;
    if (input.trim() === '') {
      setStoredCost(userId, def.id, null);
      return;
    }
    const cost = parseCost(input);
    if (cost === null) {
      addToast(`Enter an amount between 0 and ${MAX_DRINK_COST.toLocaleString('en-US')}.`, 'error');
      return;
    }
    setStoredCost(userId, def.id, cost);
  };

  const header = (
    <View>
      {showRecents && (
        <View style={{ marginBottom: 12 }}>
          <View style={styles.sectionLabel}>
            <Clock size={12} color={colors.fgSecondary} />
            <Text size={10} weight="semibold" tone="fgSecondary" uppercase tracking={0.5}>
              Recent
            </Text>
          </View>
          <View style={styles.recents}>
            {recentDrinks.map((quick) => {
              const def = resolveQuickDrink(quick, definitionById);
              const cost = selectCost(prefs, quick.definitionId);
              return (
                <PressableScale
                  key={`recent-${quick.definitionId}`}
                  scaleTo={0.96}
                  onPress={() => select(def)}
                  style={[styles.recentChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.cardBorder }]}
                  pressedStyle={{ backgroundColor: colors.surfaceSubtle }}
                >
                  <DrinkIcon category={def.category} size={14} />
                  <Text size={12} weight="medium" numberOfLines={1} style={{ maxWidth: 120 }}>
                    {def.name}
                  </Text>
                  {cost !== null && (
                    <Text size={10} tone="muted">
                      {formatCost(cost, currency)}
                    </Text>
                  )}
                </PressableScale>
              );
            })}
          </View>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onCustom}
        style={({ pressed }) => [styles.customButton, { borderColor: colors.cardBorder }, pressed && { backgroundColor: colors.card }]}
      >
        <Plus size={16} color={colors.accentText} />
        <Text size={14} weight="medium" tone="accentText">
          Custom Drink
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.flex}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Text size={16} weight="bold">
            Add Drink
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close" style={styles.close}>
            <X size={16} color={colors.fgSecondary} />
          </Pressable>
        </View>
        <TextField
          icon={(color) => <Search size={16} color={color} />}
          value={query}
          onChangeText={setQuery}
          placeholder="Search drinks..."
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          containerStyle={{ backgroundColor: colors.surfaceSubtle, minHeight: 42, marginBottom: 10 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller} contentContainerStyle={styles.chips}>
          {PICKER_CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <PressableScale
                key={c.value}
                onPress={() => {
                  hapticSelection();
                  setCategory(c.value);
                  setQuery('');
                }}
                style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surfaceSecondary }]}
              >
                <Text size={12} weight="medium" tone={active ? 'accentForeground' : 'fgSecondary'}>
                  {c.label}
                  {c.value === 'custom' && customDrinks.length > 0 ? ` (${customDrinks.length})` : ''}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={drinks}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text size={14} tone="fgSecondary" style={{ marginBottom: 8 }}>
              {category === 'favorites' ? 'No starred drinks yet' : 'No results'}
            </Text>
            {category === 'favorites' ? (
              <Text size={12} tone="muted">
                Tap the star on any drink to pin it here
              </Text>
            ) : (
              <Pressable accessibilityRole="button" onPress={onCustom}>
                <Text size={14} weight="medium" tone="accentText">
                  Add as custom
                </Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item: drink }) => {
          const isFavorite = favoriteIds.has(drink.id);
          const cost = selectCost(prefs, drink.id);
          return (
            <View style={styles.drinkRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => select(drink)}
                style={({ pressed }) => [styles.drinkMain, pressed && { backgroundColor: colors.surfaceSubtle }]}
              >
                <View style={styles.drinkIcon}>
                  <DrinkIcon category={drink.category} size={20} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size={14} weight="medium" numberOfLines={1}>
                    {drink.name}
                    {drink.id.startsWith('custom-') && (
                      <Text size={10} tone="muted">
                        {'  '}custom
                      </Text>
                    )}
                  </Text>
                  <Text size={10} tone="muted">
                    {drink.defaultAbvPercent}% · {drink.defaultVolumeMl}ml ·{' '}
                    <Text size={10} color={DRINK_CATEGORY_COLORS[drink.category] || '#71717a'}>
                      {drink.standardDrinks} std
                    </Text>
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => editPrice(drink)}
                accessibilityLabel={
                  cost === null ? `Set price for ${drink.name}` : `Change price for ${drink.name}, currently ${formatCost(cost, currency)}`
                }
                style={({ pressed }) => [
                  styles.price,
                  cost !== null && { backgroundColor: colors.surfaceSecondary },
                  pressed && { backgroundColor: colors.surfaceSubtle },
                ]}
              >
                <Text size={10} weight="medium" tone={cost === null ? 'fgFaint' : 'mutedForeground'}>
                  {cost === null ? currencySymbol(currency) : formatCost(cost, currency)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!userId) return;
                  hapticSelection();
                  toggleFavorite(userId, drink.id);
                }}
                accessibilityLabel={isFavorite ? `Unstar ${drink.name}` : `Star ${drink.name}`}
                accessibilityState={{ selected: isFavorite }}
                style={({ pressed }) => [styles.star, pressed && { backgroundColor: colors.surfaceSubtle }]}
              >
                <Star size={16} color={isFavorite ? colors.accent : colors.fgFaint} fill={isFavorite ? colors.accent : 'none'} />
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

function CustomDrinkForm({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (definition: DrinkDefinition | null, entry: ReturnType<typeof entryFromCustomDrink>) => void;
}) {
  const { colors } = useTheme();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [name, setName] = useState('');
  const [abv, setAbv] = useState('5');
  const [volume, setVolume] = useState('330');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const validationError = validateCustomDrink(name, abv, volume);

  const create = async () => {
    if (!currentUser) return;
    const err = validateCustomDrink(name, abv, volume);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSaving(true);
    const drink = { name: name.trim(), abvPercent: parseFloat(abv), volumeMl: parseFloat(volume) };
    // Saved for next time; logged either way.
    const saved = await saveCustomDrink(currentUser.id, drink);
    setSaving(false);
    onCreated(saved ? customDrinkToDefinition(saved) : null, entryFromCustomDrink(saved, drink));
  };

  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <View style={styles.formTitle}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} accessibilityLabel="Back">
          <ChevronLeft size={20} color={colors.mutedForeground} />
        </Pressable>
        <Text size={16} weight="bold">
          Custom Drink
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <TextField
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          placeholder="What are you drinking?"
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          containerStyle={{ backgroundColor: colors.surfaceSubtle }}
        />
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text size={10} tone="muted" style={{ marginBottom: 4 }}>
              ABV %
            </Text>
            <TextField
              value={abv}
              onChangeText={(v) => {
                setAbv(v);
                setError(null);
              }}
              keyboardType="decimal-pad"
              containerStyle={{ backgroundColor: colors.surfaceSubtle }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text size={10} tone="muted" style={{ marginBottom: 4 }}>
              Volume (ml)
            </Text>
            <TextField
              value={volume}
              onChangeText={(v) => {
                setVolume(v);
                setError(null);
              }}
              keyboardType="decimal-pad"
              containerStyle={{ backgroundColor: colors.surfaceSubtle }}
            />
          </View>
        </View>
        <Text size={12} tone="muted" align="center">
          ={' '}
          <Text size={12} weight="bold">
            {validationError === null ? calculateStandardDrinks(parseFloat(volume), parseFloat(abv)) : '—'}
          </Text>{' '}
          standard drinks
        </Text>
        <Text size={10} tone="fgFaint" align="center">
          This drink will be saved to your list
        </Text>
        {error && (
          <Text size={12} tone="dangerFg" align="center" accessibilityRole="alert">
            {error}
          </Text>
        )}
        <Button label="Add Drink" onPress={create} disabled={validationError !== null} disabledOpacity={0.2} loading={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  close: { padding: 6, marginRight: -6 },
  chipScroller: { marginHorizontal: -20 },
  chips: { gap: 6, paddingHorizontal: 20 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  recents: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  empty: { alignItems: 'center', paddingVertical: 40 },
  drinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  drinkMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  drinkIcon: { width: 28, alignItems: 'center' },
  price: { height: 28, minWidth: 28, paddingHorizontal: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  star: { width: 32, height: 32, marginRight: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  form: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  formTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  formRow: { flexDirection: 'row', gap: 10 },
});
