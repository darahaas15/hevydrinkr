import type { DrinkDefinition, DrinkCategory } from '@/types';
import { DRINK_CATEGORY_COLORS } from '@/lib/constants';

function calcStandardDrinks(volumeMl: number, abvPercent: number): number {
  return Math.round((volumeMl * (abvPercent / 100) * 0.789 / 14) * 10) / 10;
}

function d(
  id: string,
  name: string,
  emoji: string,
  category: DrinkCategory,
  abv: number,
  vol: number,
): DrinkDefinition {
  return {
    id,
    name,
    emoji,
    category,
    defaultAbvPercent: abv,
    defaultVolumeMl: vol,
    standardDrinks: calcStandardDrinks(vol, abv),
    color: DRINK_CATEGORY_COLORS[category] || '#71717a',
    isCustom: false,
  };
}

export const DRINK_LIBRARY: DrinkDefinition[] = [
  // ═══════════════════════════════════════════════════════════
  // BEER — Indian Brands
  // ═══════════════════════════════════════════════════════════
  d('beer-kf-premium',     'Kingfisher Premium',     '🍺', 'beer', 4.8,  330),
  d('beer-kf-strong',      'Kingfisher Strong',      '🍺', 'beer', 8.0,  330),
  d('beer-kf-ultra',       'Kingfisher Ultra',        '🍺', 'beer', 5.0,  330),
  d('beer-kf-blue',        'Kingfisher Blue',         '🍺', 'beer', 8.0,  330),
  d('beer-bira-white',     'Bira 91 White',           '🍺', 'beer', 4.7,  330),
  d('beer-bira-blonde',    'Bira 91 Blonde',          '🍺', 'beer', 4.5,  330),
  d('beer-bira-strong',    'Bira 91 Strong',          '🍺', 'beer', 8.0,  330),
  d('beer-bira-light',     'Bira 91 Light',           '🍺', 'beer', 4.0,  330),
  d('beer-haywards',       'Haywards 5000',           '🍺', 'beer', 8.0,  330),
  d('beer-godfather-s',    'Godfather Strong',        '🍺', 'beer', 7.5,  330),
  d('beer-godfather-l',    'Godfather Lager',         '🍺', 'beer', 5.0,  330),
  d('beer-simba-wit',      'Simba Wit',               '🍺', 'beer', 5.0,  330),
  d('beer-simba-strong',   'Simba Strong',            '🍺', 'beer', 7.0,  330),

  // Beer — International (popular in India)
  d('beer-tuborg',         'Tuborg Green',            '🍺', 'beer', 4.8,  330),
  d('beer-tuborg-strong',  'Tuborg Strong',           '🍺', 'beer', 8.0,  330),
  d('beer-carlsberg',      'Carlsberg Pilsner',       '🍺', 'beer', 5.0,  330),
  d('beer-carlsberg-s',    'Carlsberg Elephant',      '🍺', 'beer', 7.2,  330),
  d('beer-budweiser',      'Budweiser',               '🍺', 'beer', 5.0,  330),
  d('beer-bud-magnum',     'Budweiser Magnum',        '🍺', 'beer', 6.5,  330),
  d('beer-heineken',       'Heineken',                '🍺', 'beer', 5.0,  330),
  d('beer-corona',         'Corona Extra',            '🍺', 'beer', 4.5,  330),
  d('beer-hoegaarden',     'Hoegaarden',              '🍺', 'beer', 4.9,  330),
  d('beer-fosters',        'Foster\'s Lager',         '🍺', 'beer', 4.0,  330),

  // Beer — Generic styles
  d('beer-ipa',            'IPA',                     '🍺', 'beer', 6.5,  330),
  d('beer-stout',          'Stout',                   '🍺', 'beer', 5.5,  330),
  d('beer-pale-ale',       'Pale Ale',                '🍺', 'beer', 5.5,  330),
  d('beer-wheat',          'Wheat Beer',              '🍺', 'beer', 5.2,  330),
  d('beer-lager',          'Lager',                   '🍺', 'beer', 5.0,  330),
  d('beer-light',          'Light Beer',              '🍺', 'beer', 4.2,  330),

  // ═══════════════════════════════════════════════════════════
  // WHISKEY — Indian Blended
  // ═══════════════════════════════════════════════════════════
  d('wh-officers',         'Officer\'s Choice',       '🥃', 'whiskey', 42.8, 30),
  d('wh-mcdowells',        'McDowell\'s No.1',        '🥃', 'whiskey', 42.8, 30),
  d('wh-royal-stag',       'Royal Stag',              '🥃', 'whiskey', 42.8, 30),
  d('wh-imperial-blue',    'Imperial Blue',           '🥃', 'whiskey', 42.8, 30),
  d('wh-blenders-pride',   'Blenders Pride',          '🥃', 'whiskey', 42.8, 30),
  d('wh-royal-challenge',  'Royal Challenge',         '🥃', 'whiskey', 40.0, 30),
  d('wh-antiquity',        'Antiquity Blue',          '🥃', 'whiskey', 42.8, 30),
  d('wh-signature',        'Signature',               '🥃', 'whiskey', 42.8, 30),
  d('wh-directors',        'Director\'s Special',     '🥃', 'whiskey', 42.8, 30),
  d('wh-8pm',              '8PM',                     '🥃', 'whiskey', 42.8, 30),
  d('wh-bagpiper',         'Bagpiper',                '🥃', 'whiskey', 42.8, 30),
  d('wh-haywards-fine',    'Haywards Fine',           '🥃', 'whiskey', 42.8, 30),
  d('wh-peter-scot',       'Peter Scot',              '🥃', 'whiskey', 42.8, 30),
  d('wh-royal-green',      'Royal Green',             '🥃', 'whiskey', 42.8, 30),
  d('wh-all-seasons',      'All Seasons',             '🥃', 'whiskey', 42.8, 30),
  d('wh-sterling-reserve',  'Sterling Reserve',       '🥃', 'whiskey', 42.8, 30),
  d('wh-oaksmith',         'Oaksmith',                '🥃', 'whiskey', 42.8, 30),

  // Whiskey — Scotch (popular in India)
  d('wh-black-dog',        'Black Dog',               '🥃', 'whiskey', 42.8, 30),
  d('wh-black-white',      'Black & White',           '🥃', 'whiskey', 40.0, 30),
  d('wh-100-pipers',       '100 Pipers',              '🥃', 'whiskey', 42.8, 30),
  d('wh-teachers',         'Teacher\'s',              '🥃', 'whiskey', 40.0, 30),
  d('wh-vat69',            'Vat 69',                  '🥃', 'whiskey', 40.0, 30),
  d('wh-jw-red',           'Johnnie Walker Red',      '🥃', 'whiskey', 40.0, 30),
  d('wh-jw-black',         'Johnnie Walker Black',    '🥃', 'whiskey', 40.0, 30),
  d('wh-jw-gold',          'Johnnie Walker Gold',     '🥃', 'whiskey', 40.0, 30),
  d('wh-jw-blue',          'Johnnie Walker Blue',     '🥃', 'whiskey', 40.0, 30),
  d('wh-jack-daniels',     'Jack Daniel\'s',          '🥃', 'whiskey', 40.0, 30),
  d('wh-jamesons',         'Jameson',                 '🥃', 'whiskey', 40.0, 30),
  d('wh-chivas-12',        'Chivas Regal 12',         '🥃', 'whiskey', 40.0, 30),
  d('wh-chivas-18',        'Chivas Regal 18',         '🥃', 'whiskey', 40.0, 30),
  d('wh-glenfiddich-12',   'Glenfiddich 12',          '🥃', 'whiskey', 40.0, 30),
  d('wh-glenlivet-12',     'Glenlivet 12',            '🥃', 'whiskey', 40.0, 30),
  d('wh-monkey-shoulder',  'Monkey Shoulder',          '🥃', 'whiskey', 40.0, 30),
  d('wh-dewars',           'Dewar\'s White Label',     '🥃', 'whiskey', 40.0, 30),
  d('wh-ballantines',      'Ballantine\'s',            '🥃', 'whiskey', 40.0, 30),

  // Whiskey — Indian Single Malt (Premium)
  d('wh-amrut',            'Amrut Single Malt',       '🥃', 'whiskey', 46.0, 30),
  d('wh-amrut-fusion',     'Amrut Fusion',            '🥃', 'whiskey', 50.0, 30),
  d('wh-paul-john',        'Paul John Brilliance',    '🥃', 'whiskey', 46.0, 30),
  d('wh-paul-john-bold',   'Paul John Bold',          '🥃', 'whiskey', 46.0, 30),
  d('wh-rampur-select',    'Rampur Select',           '🥃', 'whiskey', 43.0, 30),
  d('wh-rampur-double',    'Rampur Double Cask',      '🥃', 'whiskey', 45.0, 30),

  // Whiskey — generic
  d('wh-neat',             'Whiskey Neat',            '🥃', 'whiskey', 40.0, 45),
  d('wh-on-rocks',         'Whiskey on the Rocks',    '🥃', 'whiskey', 40.0, 45),

  // ═══════════════════════════════════════════════════════════
  // VODKA
  // ═══════════════════════════════════════════════════════════
  d('vk-magic-moments',    'Magic Moments',           '🍸', 'vodka', 42.8, 30),
  d('vk-romanov',          'Romanov',                 '🍸', 'vodka', 40.0, 30),
  d('vk-white-mischief',   'White Mischief',          '🍸', 'vodka', 42.8, 30),
  d('vk-smirnoff',         'Smirnoff',                '🍸', 'vodka', 40.0, 30),
  d('vk-absolut',          'Absolut',                 '🍸', 'vodka', 40.0, 30),
  d('vk-grey-goose',       'Grey Goose',              '🍸', 'vodka', 40.0, 30),
  d('vk-belvedere',        'Belvedere',               '🍸', 'vodka', 40.0, 30),
  d('vk-ciroc',            'Ciroc',                   '🍸', 'vodka', 40.0, 30),
  d('vk-ketel-one',        'Ketel One',               '🍸', 'vodka', 40.0, 30),
  d('vk-skyy',             'Skyy',                    '🍸', 'vodka', 40.0, 30),
  d('vk-stolichnaya',      'Stolichnaya',             '🍸', 'vodka', 40.0, 30),
  d('vk-vladivar',         'Vladivar',                '🍸', 'vodka', 37.5, 30),
  d('vk-fuel',             'Fuel',                    '🍸', 'vodka', 42.8, 30),
  // Vodka — mixed
  d('vk-soda',             'Vodka Soda',              '🍸', 'vodka', 14.0, 150),
  d('vk-cranberry',        'Vodka Cranberry',         '🍸', 'vodka', 12.0, 180),
  d('vk-redbull',          'Vodka Red Bull',          '🍸', 'vodka', 12.0, 200),

  // ═══════════════════════════════════════════════════════════
  // RUM
  // ═══════════════════════════════════════════════════════════
  d('rum-old-monk',        'Old Monk',                '🥃', 'rum', 42.8, 30),
  d('rum-mcdowells',       'McDowell\'s No.1 Rum',    '🥃', 'rum', 42.8, 30),
  d('rum-hercules',        'Hercules',                '🥃', 'rum', 42.8, 30),
  d('rum-bacardi-white',   'Bacardi White',           '🥃', 'rum', 37.5, 30),
  d('rum-bacardi-dark',    'Bacardi Black',           '🥃', 'rum', 40.0, 30),
  d('rum-captain-morgan',  'Captain Morgan',          '🥃', 'rum', 35.0, 30),
  d('rum-havana-club',     'Havana Club',             '🥃', 'rum', 40.0, 30),
  d('rum-malibu',          'Malibu',                  '🥃', 'rum', 21.0, 30),
  // Rum — mixed
  d('rum-coke',            'Rum & Coke',              '🥃', 'rum', 10.0, 200),
  d('rum-old-monk-coke',   'Old Monk & Coke',         '🥃', 'rum', 10.0, 200),

  // ═══════════════════════════════════════════════════════════
  // GIN
  // ═══════════════════════════════════════════════════════════
  // Indian craft gins
  d('gin-greater-than',    'Greater Than',            '🫒', 'gin', 42.8, 30),
  d('gin-hapusa',          'Hapusa',                  '🫒', 'gin', 40.0, 30),
  d('gin-stranger-sons',   'Stranger & Sons',         '🫒', 'gin', 42.8, 30),
  d('gin-jaisalmer',       'Jaisalmer Gin',           '🫒', 'gin', 43.0, 30),
  // International gins
  d('gin-bombay-sapphire', 'Bombay Sapphire',         '🫒', 'gin', 40.0, 30),
  d('gin-tanqueray',       'Tanqueray',               '🫒', 'gin', 43.1, 30),
  d('gin-gordons',         'Gordon\'s',               '🫒', 'gin', 37.5, 30),
  d('gin-beefeater',       'Beefeater',               '🫒', 'gin', 40.0, 30),
  d('gin-hendricks',       'Hendrick\'s',             '🫒', 'gin', 41.4, 30),
  // Gin — mixed
  d('gin-tonic',           'Gin & Tonic',             '🫒', 'gin', 10.0, 200),

  // ═══════════════════════════════════════════════════════════
  // WINE
  // ═══════════════════════════════════════════════════════════
  // Indian wines
  d('wine-sula-sb',        'Sula Sauvignon Blanc',    '🍷', 'wine', 12.5, 150),
  d('wine-sula-shiraz',    'Sula Shiraz',             '🍷', 'wine', 13.5, 150),
  d('wine-sula-rose',      'Sula Zinfandel Rosé',     '🍷', 'wine', 11.5, 150),
  d('wine-sula-dindori',   'Sula Dindori Reserve',    '🍷', 'wine', 14.0, 150),
  d('wine-fratelli-red',   'Fratelli Sette',          '🍷', 'wine', 13.5, 150),
  d('wine-fratelli-white', 'Fratelli Chenin Blanc',   '🍷', 'wine', 12.5, 150),
  d('wine-grover-zampa',   'Grover Zampa La Reserve', '🍷', 'wine', 14.0, 150),
  d('wine-york',           'York Arros',              '🍷', 'wine', 14.3, 150),
  d('wine-big-banyan-s',   'Big Banyan Shiraz',       '🍷', 'wine', 13.5, 150),
  d('wine-big-banyan-v',   'Big Banyan Viognier',     '🍷', 'wine', 12.5, 150),
  // International wines
  d('wine-jacobs-shiraz',  'Jacob\'s Creek Shiraz',   '🍷', 'wine', 14.0, 150),
  d('wine-jacobs-chard',   'Jacob\'s Creek Chardonnay','🍷', 'wine', 13.1, 150),
  // Generic wines
  d('wine-red',            'Red Wine',                '🍷', 'wine', 13.5, 150),
  d('wine-white',          'White Wine',              '🍷', 'wine', 12.5, 150),
  d('wine-rose',           'Rosé',                    '🍷', 'wine', 12.0, 150),
  d('wine-champagne',      'Champagne',               '🥂', 'wine', 12.0, 150),
  d('wine-prosecco',       'Prosecco',                '🥂', 'wine', 11.0, 150),

  // ═══════════════════════════════════════════════════════════
  // BRANDY
  // ═══════════════════════════════════════════════════════════
  d('br-morpheus',         'Morpheus',                '🍷', 'brandy', 42.8, 30),
  d('br-mansion-house',    'Mansion House',           '🍷', 'brandy', 42.8, 30),
  d('br-mcdowells-no1',    'McDowell\'s No.1 Brandy', '🍷', 'brandy', 42.8, 30),
  d('br-honey-bee',        'Honey Bee',               '🍷', 'brandy', 42.8, 30),
  d('br-old-admiral',      'Old Admiral',             '🍷', 'brandy', 42.8, 30),
  d('br-men-class',        'Men\'s Club',             '🍷', 'brandy', 42.8, 30),
  d('br-dreher',           'Dreher',                  '🍷', 'brandy', 42.8, 30),
  d('br-john-exshaw',      'John Exshaw',             '🍷', 'brandy', 42.8, 30),
  d('br-hennessy-vs',      'Hennessy VS',             '🍷', 'brandy', 40.0, 30),
  d('br-hennessy-vsop',    'Hennessy VSOP',           '🍷', 'brandy', 40.0, 30),
  d('br-remy-martin',      'Rémy Martin VSOP',        '🍷', 'brandy', 40.0, 30),
  d('br-courvisier',       'Courvoisier VS',          '🍷', 'brandy', 40.0, 30),

  // ═══════════════════════════════════════════════════════════
  // TEQUILA
  // ═══════════════════════════════════════════════════════════
  d('tq-jose-cuervo',      'Jose Cuervo Gold',        '🌵', 'tequila', 40.0, 30),
  d('tq-jose-silver',      'Jose Cuervo Silver',      '🌵', 'tequila', 40.0, 30),
  d('tq-patron-silver',    'Patrón Silver',           '🌵', 'tequila', 40.0, 30),
  d('tq-patron-reposado',  'Patrón Reposado',         '🌵', 'tequila', 40.0, 30),
  d('tq-don-julio',        'Don Julio Blanco',        '🌵', 'tequila', 40.0, 30),
  d('tq-olmeca',           'Olmeca Gold',             '🌵', 'tequila', 38.0, 30),
  d('tq-camino',           'Camino Real',             '🌵', 'tequila', 40.0, 30),
  d('tq-sauza',            'Sauza Silver',            '🌵', 'tequila', 40.0, 30),
  d('tq-clase-azul',       'Clase Azul Reposado',     '🌵', 'tequila', 40.0, 30),

  // ═══════════════════════════════════════════════════════════
  // COCKTAILS
  // ═══════════════════════════════════════════════════════════
  d('ck-margarita',        'Margarita',               '🍹', 'cocktail', 13.0, 240),
  d('ck-old-fashioned',    'Old Fashioned',           '🍹', 'cocktail', 32.0,  90),
  d('ck-mojito',           'Mojito',                  '🍹', 'cocktail', 10.0, 240),
  d('ck-espresso-martini', 'Espresso Martini',        '🍹', 'cocktail', 15.0, 180),
  d('ck-negroni',          'Negroni',                 '🍹', 'cocktail', 24.0,  90),
  d('ck-aperol-spritz',    'Aperol Spritz',           '🍹', 'cocktail',  8.0, 200),
  d('ck-long-island',      'Long Island Iced Tea',    '🍹', 'cocktail', 22.0, 240),
  d('ck-moscow-mule',      'Moscow Mule',             '🍹', 'cocktail', 10.0, 240),
  d('ck-pina-colada',      'Piña Colada',             '🍹', 'cocktail', 13.0, 240),
  d('ck-daiquiri',         'Daiquiri',                '🍹', 'cocktail', 15.0, 180),
  d('ck-cosmopolitan',     'Cosmopolitan',            '🍹', 'cocktail', 15.0, 180),
  d('ck-whiskey-sour',     'Whiskey Sour',            '🍹', 'cocktail', 15.0, 180),
  d('ck-mai-tai',          'Mai Tai',                 '🍹', 'cocktail', 14.0, 240),
  d('ck-liiit',            'LIIT',                    '🍹', 'cocktail', 22.0, 240),

  // ═══════════════════════════════════════════════════════════
  // SHOTS
  // ═══════════════════════════════════════════════════════════
  d('shot-tequila',        'Tequila Shot',            '🥂', 'shot', 40.0,  30),
  d('shot-jagerbomb',      'Jägerbomb',               '🥂', 'shot',  7.0, 195),
  d('shot-fireball',       'Fireball Shot',           '🥂', 'shot', 33.0,  30),
  d('shot-kamikaze',       'Kamikaze',                '🥂', 'shot', 22.0,  30),
  d('shot-b52',            'B-52',                    '🥂', 'shot', 26.0,  30),
  d('shot-vodka',          'Vodka Shot',              '🥂', 'shot', 40.0,  30),
  d('shot-whiskey',        'Whiskey Shot',            '🥂', 'shot', 40.0,  30),
  d('shot-rum',            'Rum Shot',                '🥂', 'shot', 40.0,  30),
  d('shot-jagermeister',   'Jagermeister',            '🥂', 'shot', 35.0,  30),
  d('shot-sambuca',        'Sambuca',                 '🥂', 'shot', 38.0,  30),
  d('shot-absinthe',       'Absinthe',                '🥂', 'shot', 60.0,  30),
  d('shot-baileys',        'Baileys',                 '🥂', 'shot', 17.0,  30),
  d('shot-kahlua',         'Kahlúa',                  '🥂', 'shot', 20.0,  30),

  // ═══════════════════════════════════════════════════════════
  // DESI / COUNTRY LIQUOR
  // ═══════════════════════════════════════════════════════════
  d('desi-toddy',          'Toddy (Palm Wine)',        '🫗', 'desi',  5.0, 200),
  d('desi-feni',           'Feni (Goan)',              '🫗', 'desi', 43.0,  30),
  d('desi-arrack',         'Arrack',                   '🫗', 'desi', 40.0,  30),
  d('desi-mahua',          'Mahua',                    '🫗', 'desi', 40.0,  30),

  // ═══════════════════════════════════════════════════════════
  // CIDER & SELTZER
  // ═══════════════════════════════════════════════════════════
  d('cider-apple',         'Apple Cider',             '🍏', 'cider', 5.0, 330),
  d('cider-pear',          'Pear Cider',              '🍏', 'cider', 4.5, 330),
  d('seltzer-hard',        'Hard Seltzer',            '🫧', 'seltzer', 5.0, 330),
  d('seltzer-lemonade',    'Spiked Lemonade',         '🫧', 'seltzer', 5.0, 330),
];

// ── Helper functions ────────────────────────────────────────

export function getDrinksByCategory(category: DrinkCategory): DrinkDefinition[] {
  return DRINK_LIBRARY.filter((drink) => drink.category === category);
}

export function getDrinkById(id: string): DrinkDefinition | undefined {
  return DRINK_LIBRARY.find((drink) => drink.id === id);
}

export function searchDrinks(query: string): DrinkDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return DRINK_LIBRARY;
  return DRINK_LIBRARY.filter(
    (drink) =>
      drink.name.toLowerCase().includes(q) ||
      drink.category.toLowerCase().includes(q),
  );
}
