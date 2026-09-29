import { describe, it, expect } from 'vitest';
import { beerVolumeMl, drinkLevel, gaugeProgress, gaugeVolumeLabel, spiritsVolumeMl } from './drink-gauge';
import { makeDrink } from '../../tests/helpers/factories';

describe('drinkLevel', () => {
  it('climbs through the five levels at 2, 4, 7 and 10 standard drinks', () => {
    expect(drinkLevel(0)).toEqual({ label: 'Getting Started', level: 1 });
    expect(drinkLevel(1.9).level).toBe(1);
    expect(drinkLevel(2)).toEqual({ label: 'Warming Up', level: 2 });
    expect(drinkLevel(4)).toEqual({ label: 'In The Zone', level: 3 });
    expect(drinkLevel(7)).toEqual({ label: 'Going Hard', level: 4 });
    expect(drinkLevel(10)).toEqual({ label: 'Beast Mode', level: 5 });
  });
});

describe('spirit and beer volumes', () => {
  const drinks = [
    makeDrink({ category: 'whiskey', volumeMl: 60 }),
    makeDrink({ category: 'desi', volumeMl: 90 }),
    makeDrink({ category: 'beer', volumeMl: 650 }),
    makeDrink({ category: 'cider', volumeMl: 330 }),
    makeDrink({ category: 'wine', volumeMl: 150 }),
  ];

  it('counts spirits (incl. shots and desi) and beers (incl. cider and seltzer), not wine', () => {
    expect(spiritsVolumeMl(drinks)).toBe(150);
    expect(beerVolumeMl(drinks)).toBe(980);
  });
});

describe('gaugeProgress', () => {
  it('is the filled share of the arc, capped at full', () => {
    expect(gaugeProgress(0, 15)).toBe(0);
    expect(gaugeProgress(7.5, 15)).toBe(0.5);
    expect(gaugeProgress(40, 15)).toBe(1);
  });
});

describe('gaugeVolumeLabel', () => {
  it('shows whole millilitres below a litre', () => {
    expect(gaugeVolumeLabel(0)).toEqual({ value: '0', unit: 'ml' });
    expect(gaugeVolumeLabel(329.6)).toEqual({ value: '330', unit: 'ml' });
  });

  it('switches to litres with one decimal from 1000 ml', () => {
    expect(gaugeVolumeLabel(1000)).toEqual({ value: '1.0', unit: 'litres' });
    expect(gaugeVolumeLabel(1500)).toEqual({ value: '1.5', unit: 'litres' });
  });
});
