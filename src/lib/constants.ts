export const APP_NAME = 'hevydrinkr';
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

export const DRINK_CATEGORY_EMOJIS: Record<string, string> = {
  beer: '🍺',
  wine: '🍷',
  cocktail: '🍹',
  whiskey: '🥃',
  vodka: '🍸',
  rum: '🥃',
  gin: '🫒',
  brandy: '🍷',
  tequila: '🌵',
  shot: '🥂',
  cider: '🍏',
  seltzer: '🫧',
  desi: '🫗',
  custom: '🍸',
};

export const STORAGE_KEYS = {
  AUTH: 'hevydrinkr-auth',
  SESSIONS: 'hevydrinkr-sessions',
  FEED: 'hevydrinkr-feed',
  GROUPS: 'hevydrinkr-groups',
  PROFILE: 'hevydrinkr-profile',
  PARTY: 'hevydrinkr-party',
  UI: 'hevydrinkr-ui',
  SEEDED: 'hevydrinkr-seeded',
} as const;
