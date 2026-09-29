import { describe, it, expect } from 'vitest';
import {
  buildDefinitionIndex,
  customDrinkToDefinition,
  entryFromCustomDrink,
  entryFromDefinition,
  filterPickerDrinks,
  resolveQuickDrink,
  validateCustomDrink,
  type CustomDrinkRow,
} from './drink-picker';
import { DRINK_LIBRARY, getDrinksByCategory } from '@/lib/data/drink-library';
import type { QuickDrink } from '@/stores/use-drink-prefs-store';

const row: CustomDrinkRow = {
  id: 'abc',
  name: 'House Punch',
  emoji: '🍸',
  category: 'custom',
  abv_percent: 12,
  volume_ml: 250,
};

describe('validateCustomDrink', () => {
  it('accepts a sensible drink', () => {
    expect(validateCustomDrink('House Punch', '12', '250')).toBeNull();
  });

  it('requires a name of at most 60 characters', () => {
    expect(validateCustomDrink('   ', '5', '330')).toBe('Give your drink a name.');
    expect(validateCustomDrink('x'.repeat(61), '5', '330')).toBe('Name is too long (max 60 chars).');
  });

  it('bounds ABV to 0.1-80% and volume to 10-2000 ml', () => {
    expect(validateCustomDrink('A', '0', '330')).toBe('ABV must be between 0.1% and 80%.');
    expect(validateCustomDrink('A', '81', '330')).toBe('ABV must be between 0.1% and 80%.');
    expect(validateCustomDrink('A', 'abc', '330')).toBe('ABV must be between 0.1% and 80%.');
    expect(validateCustomDrink('A', '5', '9')).toBe('Volume must be between 10 and 2000 ml.');
    expect(validateCustomDrink('A', '5', '2001')).toBe('Volume must be between 10 and 2000 ml.');
  });
});

describe('customDrinkToDefinition', () => {
  it('prefixes the id and computes standard drinks from the saved pour', () => {
    const def = customDrinkToDefinition(row);
    expect(def.id).toBe('custom-abc');
    expect(def.isCustom).toBe(true);
    expect(def.defaultAbvPercent).toBe(12);
    expect(def.defaultVolumeMl).toBe(250);
    expect(def.standardDrinks).toBeCloseTo(1.7, 1);
  });
});

describe('entryFromDefinition', () => {
  it('logs the default pour with the remembered price', () => {
    const def = DRINK_LIBRARY[0];
    const entry = entryFromDefinition(def, 250);
    expect(entry.drinkDefinitionId).toBe(def.id);
    expect(entry.drinkName).toBe(def.name);
    expect(entry.volumeMl).toBe(def.defaultVolumeMl);
    expect(entry.abvPercent).toBe(def.defaultAbvPercent);
    expect(entry.cost).toBe(250);
    expect(entry.roundId).toBeNull();
    expect(entryFromDefinition(def, 250).id).not.toBe(entry.id);
  });
});

describe('entryFromCustomDrink', () => {
  const drink = { name: 'House Punch', abvPercent: 12, volumeMl: 250 };

  it('links to the saved custom drink', () => {
    const entry = entryFromCustomDrink(row, drink);
    expect(entry.drinkDefinitionId).toBe('custom-abc');
    expect(entry.category).toBe('custom');
    expect(entry.cost).toBeNull();
  });

  it('still logs the drink when the save failed', () => {
    const entry = entryFromCustomDrink(null, drink);
    expect(entry.drinkDefinitionId).toMatch(/^custom-/);
    expect(entry.drinkDefinitionId).not.toBe('custom-abc');
    expect(entry.drinkName).toBe('House Punch');
  });
});

describe('resolveQuickDrink', () => {
  const quick: QuickDrink = {
    definitionId: DRINK_LIBRARY[0].id,
    name: 'Stale name',
    emoji: '🍺',
    category: DRINK_LIBRARY[0].category,
    abvPercent: 1,
    volumeMl: 1,
    standardDrinks: 0,
  };

  it('prefers the live library definition over the remembered snapshot', () => {
    expect(resolveQuickDrink(quick, buildDefinitionIndex([]))).toBe(DRINK_LIBRARY[0]);
  });

  it('falls back to the snapshot for a drink no longer in the index', () => {
    const gone = { ...quick, definitionId: 'custom-deleted' };
    const def = resolveQuickDrink(gone, buildDefinitionIndex([]));
    expect(def.id).toBe('custom-deleted');
    expect(def.name).toBe('Stale name');
    expect(def.isCustom).toBe(true);
  });
});

describe('filterPickerDrinks', () => {
  const custom = [customDrinkToDefinition(row)];
  const favorites = [DRINK_LIBRARY[1]];

  it('shows custom drinks then the whole library on All', () => {
    const out = filterPickerDrinks({ query: '', category: 'all', customDrinks: custom, favorites });
    expect(out[0]).toBe(custom[0]);
    expect(out).toHaveLength(DRINK_LIBRARY.length + 1);
  });

  it('searches every drink by name, custom first, ignoring the category', () => {
    const out = filterPickerDrinks({ query: 'PUNCH', category: 'beer', customDrinks: custom, favorites });
    expect(out[0]).toBe(custom[0]);
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((d) => d.name.toLowerCase().includes('punch'))).toBe(true);
    expect(out.some((d) => d.category !== 'beer')).toBe(true);
  });

  it('narrows to custom, starred, or a library category', () => {
    expect(filterPickerDrinks({ query: '', category: 'custom', customDrinks: custom, favorites })).toEqual(custom);
    expect(filterPickerDrinks({ query: '', category: 'favorites', customDrinks: custom, favorites })).toEqual(favorites);
    expect(filterPickerDrinks({ query: '', category: 'wine', customDrinks: custom, favorites })).toEqual(
      getDrinksByCategory('wine'),
    );
  });
});
