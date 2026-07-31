import { describe, it, expect, beforeEach } from 'vitest';
import {
  useDrinkPrefsStore,
  selectPrefs,
  selectRecents,
  selectFavorites,
  selectQuickPicks,
  selectCost,
  quickDrinkFromEntry,
  entryFromQuickDrink,
  type QuickDrink,
} from './use-drink-prefs-store';
import { DEFAULT_CURRENCY } from '@/lib/money';
import { makeDrink } from '../../tests/helpers/factories';

const USER = 'user-1';
const OTHER = 'user-2';

const quick = (id: string, name = id): QuickDrink => ({
  definitionId: id,
  name,
  emoji: '🍺',
  category: 'beer',
  abvPercent: 5,
  volumeMl: 330,
  standardDrinks: 1,
});

const prefsFor = (userId: string) => selectPrefs(useDrinkPrefsStore.getState().byUser, userId);

beforeEach(() => {
  useDrinkPrefsStore.setState({ byUser: {}, currency: DEFAULT_CURRENCY });
});

describe('recordUse', () => {
  it('puts the newest drink first', () => {
    const { recordUse } = useDrinkPrefsStore.getState();
    recordUse(USER, quick('a'));
    recordUse(USER, quick('b'));
    expect(selectRecents(prefsFor(USER)).map((d) => d.definitionId)).toEqual(['b', 'a']);
  });

  it('re-logging an existing drink moves it to the front without duplicating', () => {
    const { recordUse } = useDrinkPrefsStore.getState();
    recordUse(USER, quick('a'));
    recordUse(USER, quick('b'));
    recordUse(USER, quick('a'));
    expect(selectRecents(prefsFor(USER)).map((d) => d.definitionId)).toEqual(['b', 'a'].reverse());
  });

  it('caps recents so the list stays a shortcut, not an archive', () => {
    const { recordUse } = useDrinkPrefsStore.getState();
    for (let i = 0; i < 30; i++) recordUse(USER, quick(`d${i}`));
    const recents = selectRecents(prefsFor(USER), 100);
    expect(recents).toHaveLength(12);
    expect(recents[0].definitionId).toBe('d29');
  });

  it('prunes templates for drinks that fell out of recents', () => {
    const { recordUse } = useDrinkPrefsStore.getState();
    for (let i = 0; i < 30; i++) recordUse(USER, quick(`d${i}`));
    expect(prefsFor(USER).templates.d0).toBeUndefined();
    expect(prefsFor(USER).templates.d29).toBeDefined();
  });

  it('keeps a starred drink usable after it falls out of recents', () => {
    const { recordUse, toggleFavorite } = useDrinkPrefsStore.getState();
    recordUse(USER, quick('keeper'));
    toggleFavorite(USER, 'keeper');
    for (let i = 0; i < 20; i++) recordUse(USER, quick(`d${i}`));

    expect(selectRecents(prefsFor(USER), 100).map((d) => d.definitionId)).not.toContain('keeper');
    expect(selectFavorites(prefsFor(USER)).map((d) => d.definitionId)).toEqual(['keeper']);
  });

  it('keeps users separate so a shared device does not leak habits', () => {
    const { recordUse } = useDrinkPrefsStore.getState();
    recordUse(USER, quick('mine'));
    recordUse(OTHER, quick('theirs'));
    expect(selectRecents(prefsFor(USER)).map((d) => d.definitionId)).toEqual(['mine']);
    expect(selectRecents(prefsFor(OTHER)).map((d) => d.definitionId)).toEqual(['theirs']);
  });

  it('ignores calls with no signed-in user', () => {
    useDrinkPrefsStore.getState().recordUse('', quick('a'));
    expect(useDrinkPrefsStore.getState().byUser).toEqual({});
  });
});

describe('favourites', () => {
  it('toggles on and off', () => {
    const { toggleFavorite } = useDrinkPrefsStore.getState();
    toggleFavorite(USER, 'a');
    expect(prefsFor(USER).favoriteIds).toEqual(['a']);
    toggleFavorite(USER, 'a');
    expect(prefsFor(USER).favoriteIds).toEqual([]);
  });

  it('is reported by isFavorite', () => {
    const store = useDrinkPrefsStore.getState();
    store.toggleFavorite(USER, 'a');
    expect(useDrinkPrefsStore.getState().isFavorite(USER, 'a')).toBe(true);
    expect(useDrinkPrefsStore.getState().isFavorite(USER, 'b')).toBe(false);
  });
});

describe('selectQuickPicks', () => {
  it('puts favourites before recents and de-dupes overlap', () => {
    const { recordUse, toggleFavorite } = useDrinkPrefsStore.getState();
    recordUse(USER, quick('a'));
    recordUse(USER, quick('b'));
    recordUse(USER, quick('c'));
    toggleFavorite(USER, 'a');
    expect(selectQuickPicks(prefsFor(USER)).map((d) => d.definitionId)).toEqual(['a', 'c', 'b']);
  });

  it('respects the limit', () => {
    const { recordUse } = useDrinkPrefsStore.getState();
    for (let i = 0; i < 8; i++) recordUse(USER, quick(`d${i}`));
    expect(selectQuickPicks(prefsFor(USER), 3)).toHaveLength(3);
  });

  it('skips a starred id that has no template yet', () => {
    const { toggleFavorite } = useDrinkPrefsStore.getState();
    toggleFavorite(USER, 'never-logged');
    expect(selectQuickPicks(prefsFor(USER))).toEqual([]);
  });
});

describe('cost memory', () => {
  it('remembers and returns a price', () => {
    useDrinkPrefsStore.getState().setCost(USER, 'a', 250);
    expect(selectCost(prefsFor(USER), 'a')).toBe(250);
  });

  it('returns null for a drink with no recorded price', () => {
    expect(selectCost(prefsFor(USER), 'a')).toBeNull();
  });

  it('clears a price when set to null', () => {
    const { setCost } = useDrinkPrefsStore.getState();
    setCost(USER, 'a', 250);
    setCost(USER, 'a', null);
    expect(selectCost(prefsFor(USER), 'a')).toBeNull();
  });

  it('treats a recorded zero as a real price, not "unset"', () => {
    useDrinkPrefsStore.getState().setCost(USER, 'a', 0);
    expect(selectCost(prefsFor(USER), 'a')).toBe(0);
  });

  it('survives the drink falling out of recents', () => {
    const { recordUse, setCost } = useDrinkPrefsStore.getState();
    recordUse(USER, quick('a'));
    setCost(USER, 'a', 250);
    for (let i = 0; i < 20; i++) recordUse(USER, quick(`d${i}`));
    expect(selectCost(prefsFor(USER), 'a')).toBe(250);
  });
});

describe('selectPrefs', () => {
  it('returns an empty shape for an unknown or absent user', () => {
    expect(selectPrefs({}, undefined).recentIds).toEqual([]);
    expect(selectPrefs({}, 'nobody').favoriteIds).toEqual([]);
  });
});

describe('QuickDrink conversions', () => {
  it('round-trips an entry through QuickDrink', () => {
    const entry = makeDrink({ drinkName: 'Kingfisher', drinkDefinitionId: 'beer-kf' });
    const q = quickDrinkFromEntry(entry);
    expect(q).toMatchObject({ definitionId: 'beer-kf', name: 'Kingfisher', standardDrinks: 1 });

    const rebuilt = entryFromQuickDrink(q, 250);
    expect(rebuilt).toMatchObject({
      drinkDefinitionId: 'beer-kf',
      drinkName: 'Kingfisher',
      cost: 250,
      roundId: null,
    });
    expect(rebuilt.id).not.toBe(entry.id);
  });

  it('defaults cost to null when no price is known', () => {
    expect(entryFromQuickDrink(quick('a')).cost).toBeNull();
  });
});
