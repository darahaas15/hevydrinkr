import { describe, it, expect } from 'vitest';
import { groupDrinksByDefinition, latestEntry, repeatDrink } from './drink-groups';
import { makeDrink } from '../../tests/helpers/factories';

describe('groupDrinksByDefinition', () => {
  it('collapses repeats and lists the most recently started drink first', () => {
    const beer1 = makeDrink({ drinkDefinitionId: 'beer' });
    const wine = makeDrink({ drinkDefinitionId: 'wine' });
    const beer2 = makeDrink({ drinkDefinitionId: 'beer' });
    const groups = groupDrinksByDefinition([beer1, wine, beer2]);

    expect(groups.map((g) => g.key)).toEqual(['wine', 'beer']);
    expect(groups[1].quantity).toBe(2);
    expect(groups[1].entries).toEqual([beer1, beer2]);
    expect(groups[1].template).toBe(beer1);
  });

  it('is empty for no drinks', () => {
    expect(groupDrinksByDefinition([])).toEqual([]);
  });
});

describe('latestEntry', () => {
  it('is the most recently logged entry of the group', () => {
    const first = makeDrink({ drinkDefinitionId: 'beer' });
    const second = makeDrink({ drinkDefinitionId: 'beer' });
    const [group] = groupDrinksByDefinition([first, second]);
    expect(latestEntry(group)).toBe(second);
  });
});

describe('repeatDrink', () => {
  it('copies the drink with a new id, a fresh timestamp, and no round', () => {
    const template = makeDrink({ roundId: 'round-1', timestamp: '2020-01-01T00:00:00.000Z', cost: 300 });
    const next = repeatDrink(template);
    expect(next.id).not.toBe(template.id);
    expect(next.roundId).toBeNull();
    expect(next.timestamp).not.toBe(template.timestamp);
    expect(next.drinkDefinitionId).toBe(template.drinkDefinitionId);
    expect(next.cost).toBe(300);
  });
});
