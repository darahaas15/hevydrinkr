export const APP_NAME = 'Drinkr';
export const APP_DESCRIPTION = 'Track your party sessions like a pro';


export const BAC_LEVELS = {
  SOBER: 0,
  BUZZED: 0.04,
  TIPSY: 0.08,
  DRUNK: 0.12,
  WASTED: 0.20,
} as const;

export const BAC_COLORS = {
  SOBER: '#22c55e',
  BUZZED: '#f59e0b',
  TIPSY: '#f97316',
  DRUNK: '#ef4444',
  WASTED: '#dc2626',
} as const;

export const BAC_LEGAL_LIMIT = 0.08;

export const BAC_LEVEL_LABELS: Record<string, { label: string; description: string }> = {
  SOBER: { label: 'Sober', description: 'Minimal effects' },
  BUZZED: { label: 'Buzzed', description: 'Mild impairment, reduced inhibitions' },
  TIPSY: { label: 'Tipsy', description: 'Legally impaired — do not drive' },
  DRUNK: { label: 'Drunk', description: 'Significant impairment, poor coordination' },
  WASTED: { label: 'Wasted', description: 'Severe impairment, risk of blackout' },
};

export const BAC_DISCLAIMER = 'BAC is an estimate only — never use it to decide if you\'re OK to drive.';

export const SESSION_MOODS = [
  { value: 'legendary' as const, emoji: '🤩', label: 'Legendary' },
  { value: 'great' as const, emoji: '😄', label: 'Great' },
  { value: 'good' as const, emoji: '🙂', label: 'Good' },
  { value: 'meh' as const, emoji: '😐', label: 'Meh' },
  { value: 'rough' as const, emoji: '🤢', label: 'Rough' },
];

export const DRINK_CATEGORY_COLORS: Record<string, string> = {
  beer: '#f59e0b',
  wine: '#dc2626',
  cocktail: '#ec4899',
  whiskey: '#a855f7',
  vodka: '#38bdf8',
  rum: '#f97316',
  gin: '#22d3ee',
  brandy: '#b45309',
  tequila: '#84cc16',
  shot: '#06b6d4',
  cider: '#22c55e',
  seltzer: '#38bdf8',
  desi: '#e879f9',
  custom: '#71717a',
};

import type { ComponentType } from 'react';
import {
  IconBeer,
  IconGlassCocktail,
  IconGlass,
  IconBottle,
  IconBarrel,
  IconGlassGin,
  IconGlassFull,
  IconCactus,
  IconFlask,
  IconApple,
  IconDroplets,
  IconFlame,
  IconGlassChampagne,
  IconCup,
} from '@tabler/icons-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DRINK_CATEGORY_ICONS: Record<string, ComponentType<any>> = {
  beer: IconBeer,
  wine: IconGlass,
  cocktail: IconGlassChampagne,
  whiskey: IconGlassFull,
  vodka: IconGlassCocktail,
  rum: IconBarrel,
  gin: IconGlassGin,
  brandy: IconGlassFull,
  tequila: IconCactus,
  shot: IconFlask,
  cider: IconApple,
  seltzer: IconDroplets,
  desi: IconFlame,
  custom: IconCup,
};

export const STORAGE_KEYS = {
  AUTH: 'drinkr-auth',
  SESSIONS: 'drinkr-sessions',
  FEED: 'drinkr-feed',
  GROUPS: 'drinkr-groups',
  PROFILE: 'drinkr-profile',
  PARTY: 'drinkr-party',
  UI: 'drinkr-ui',
  SEEDED: 'drinkr-seeded',
} as const;
