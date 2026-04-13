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

  // Beer — Indian Brands (500ml)
  d('beer-kf-premium-500',  'Kingfisher Premium 500ml',  '🍺', 'beer', 4.8,  500),
  d('beer-kf-strong-500',   'Kingfisher Strong 500ml',   '🍺', 'beer', 8.0,  500),
  d('beer-kf-ultra-500',    'Kingfisher Ultra 500ml',    '🍺', 'beer', 5.0,  500),
  d('beer-kf-blue-500',     'Kingfisher Blue 500ml',     '🍺', 'beer', 8.0,  500),
  d('beer-bira-white-500',  'Bira 91 White 500ml',       '🍺', 'beer', 4.7,  500),
  d('beer-bira-blonde-500', 'Bira 91 Blonde 500ml',      '🍺', 'beer', 4.5,  500),
  d('beer-bira-strong-500', 'Bira 91 Strong 500ml',      '🍺', 'beer', 8.0,  500),
  d('beer-bira-light-500',  'Bira 91 Light 500ml',       '🍺', 'beer', 4.0,  500),
  d('beer-haywards-500',    'Haywards 5000 500ml',       '🍺', 'beer', 8.0,  500),
  d('beer-godfather-s-500', 'Godfather Strong 500ml',    '🍺', 'beer', 7.5,  500),
  d('beer-godfather-l-500', 'Godfather Lager 500ml',     '🍺', 'beer', 5.0,  500),
  d('beer-simba-wit-500',   'Simba Wit 500ml',           '🍺', 'beer', 5.0,  500),
  d('beer-simba-strong-500','Simba Strong 500ml',        '🍺', 'beer', 7.0,  500),

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

  // Beer — International (500ml)
  d('beer-tuborg-500',        'Tuborg Green 500ml',        '🍺', 'beer', 4.8,  500),
  d('beer-tuborg-strong-500', 'Tuborg Strong 500ml',       '🍺', 'beer', 8.0,  500),
  d('beer-carlsberg-500',     'Carlsberg Pilsner 500ml',   '🍺', 'beer', 5.0,  500),
  d('beer-carlsberg-s-500',   'Carlsberg Elephant 500ml',  '🍺', 'beer', 7.2,  500),
  d('beer-budweiser-500',     'Budweiser 500ml',           '🍺', 'beer', 5.0,  500),
  d('beer-bud-magnum-500',    'Budweiser Magnum 500ml',    '🍺', 'beer', 6.5,  500),
  d('beer-heineken-500',      'Heineken 500ml',            '🍺', 'beer', 5.0,  500),
  d('beer-corona-500',        'Corona Extra 500ml',        '🍺', 'beer', 4.5,  500),
  d('beer-hoegaarden-500',    'Hoegaarden 500ml',          '🍺', 'beer', 4.9,  500),
  d('beer-fosters-500',       'Foster\'s Lager 500ml',     '🍺', 'beer', 4.0,  500),

  // Beer — Generic styles
  d('beer-ipa',            'IPA',                     '🍺', 'beer', 6.5,  330),
  d('beer-stout',          'Stout',                   '🍺', 'beer', 5.5,  330),
  d('beer-pale-ale',       'Pale Ale',                '🍺', 'beer', 5.5,  330),
  d('beer-wheat',          'Wheat Beer',              '🍺', 'beer', 5.2,  330),
  d('beer-lager',          'Lager',                   '🍺', 'beer', 5.0,  330),
  d('beer-light',          'Light Beer',              '🍺', 'beer', 4.2,  330),

  // Beer — Generic styles (500ml)
  d('beer-ipa-500',       'IPA 500ml',               '🍺', 'beer', 6.5,  500),
  d('beer-stout-500',     'Stout 500ml',             '🍺', 'beer', 5.5,  500),
  d('beer-pale-ale-500',  'Pale Ale 500ml',          '🍺', 'beer', 5.5,  500),
  d('beer-wheat-500',     'Wheat Beer 500ml',        '🍺', 'beer', 5.2,  500),
  d('beer-lager-500',     'Lager 500ml',             '🍺', 'beer', 5.0,  500),
  d('beer-light-500',     'Light Beer 500ml',        '🍺', 'beer', 4.2,  500),

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
  d('wh-neat',             'Whiskey Neat',            '🥃', 'whiskey', 40.0, 30),
  d('wh-on-rocks',         'Whiskey on the Rocks',    '🥃', 'whiskey', 40.0, 30),

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
  d('vk-titos',            'Tito\'s',                 '🍸', 'vodka', 40.0, 30),
  d('vk-beluga',           'Beluga Noble',            '🍸', 'vodka', 40.0, 30),
  d('vk-zubrowka',         'Żubrówka',                '🍸', 'vodka', 40.0, 30),
  d('vk-finlandia',        'Finlandia',               '🍸', 'vodka', 40.0, 30),
  d('vk-russian-standard', 'Russian Standard',        '🍸', 'vodka', 40.0, 30),
  // Vodka — mixed
  d('vk-soda',             'Vodka Soda',              '🍸', 'vodka', 40.0,  30),
  d('vk-cranberry',        'Vodka Cranberry',         '🍸', 'vodka', 40.0,  30),
  d('vk-redbull',          'Vodka Red Bull',           '🍸', 'vodka', 40.0,  30),
  d('vk-lime-soda',        'Vodka Lime Soda',         '🍸', 'vodka', 40.0,  30),

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
  d('rum-kraken',          'Kraken Black Spiced',     '🥃', 'rum', 40.0, 30),
  d('rum-diplomatico',     'Diplomático Reserva',     '🥃', 'rum', 40.0, 30),
  d('rum-appleton',        'Appleton Estate',         '🥃', 'rum', 40.0, 30),
  d('rum-mount-gay',       'Mount Gay Eclipse',       '🥃', 'rum', 40.0, 30),
  d('rum-plantation',      'Plantation 3 Stars',      '🥃', 'rum', 41.2, 30),
  d('rum-sailor-jerry',    'Sailor Jerry',            '🥃', 'rum', 40.0, 30),
  d('rum-goslings',        'Gosling\'s Black Seal',   '🥃', 'rum', 40.0, 30),
  // Rum — mixed
  d('rum-coke',            'Rum & Coke',              '🥃', 'rum', 40.0,  30),
  d('rum-old-monk-coke',   'Old Monk & Coke',         '🥃', 'rum', 42.8, 30),

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
  d('gin-monkey47',        'Monkey 47',               '🫒', 'gin', 47.0, 30),
  d('gin-roku',            'Roku',                    '🫒', 'gin', 43.0, 30),
  d('gin-aviation',        'Aviation Gin',            '🫒', 'gin', 42.0, 30),
  d('gin-sipsmith',        'Sipsmith',                '🫒', 'gin', 41.6, 30),
  d('gin-the-botanist',    'The Botanist',            '🫒', 'gin', 46.0, 30),
  d('gin-star-of-bombay',  'Star of Bombay',          '🫒', 'gin', 47.5, 30),
  d('gin-malfy',           'Malfy',                   '🫒', 'gin', 41.0, 30),
  // Gin — mixed
  d('gin-tonic',           'Gin & Tonic',             '🫒', 'gin', 40.0, 30),
  d('gin-lime-soda',       'Gin Lime Soda',           '🫒', 'gin', 40.0, 30),

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
  d('tq-casamigos-b',      'Casamigos Blanco',        '🌵', 'tequila', 40.0, 30),
  d('tq-casamigos-r',      'Casamigos Reposado',      '🌵', 'tequila', 40.0, 30),
  d('tq-casamigos-a',      'Casamigos Añejo',         '🌵', 'tequila', 40.0, 30),
  d('tq-1800-silver',      '1800 Silver',             '🌵', 'tequila', 40.0, 30),
  d('tq-1800-reposado',    '1800 Reposado',           '🌵', 'tequila', 40.0, 30),
  d('tq-herradura-silver',  'Herradura Silver',       '🌵', 'tequila', 40.0, 30),
  d('tq-herradura-repo',    'Herradura Reposado',     '🌵', 'tequila', 40.0, 30),
  d('tq-espolon-b',        'Espolòn Blanco',          '🌵', 'tequila', 40.0, 30),
  d('tq-espolon-r',        'Espolòn Reposado',        '🌵', 'tequila', 40.0, 30),
  d('tq-milagro-silver',   'Milagro Silver',          '🌵', 'tequila', 40.0, 30),
  d('tq-hornitos-plata',   'Hornitos Plata',          '🌵', 'tequila', 40.0, 30),
  d('tq-el-jimador',       'El Jimador Blanco',       '🌵', 'tequila', 40.0, 30),
  d('tq-mezcal-vida',      'Del Maguey Vida Mezcal',  '🌵', 'tequila', 42.0, 30),
  d('tq-mezcal-400',       '400 Conejos Mezcal',      '🌵', 'tequila', 40.0, 30),
  d('tq-mezcal-montelobos', 'Montelobos Mezcal',      '🌵', 'tequila', 43.2, 30),

  // ═══════════════════════════════════════════════════════════
  // COCKTAILS
  // ═══════════════════════════════════════════════════════════
  d('ck-margarita',        'Margarita',               '🍹', 'cocktail', 40.0,  60),  // 60ml tequila+triple sec
  d('ck-old-fashioned',    'Old Fashioned',           '🍹', 'cocktail', 40.0,  60),  // 60ml whiskey
  d('ck-mojito',           'Mojito',                  '🍹', 'cocktail', 40.0,  30),  // 30ml rum
  d('ck-espresso-martini', 'Espresso Martini',        '🍹', 'cocktail', 40.0,  60),  // 30ml vodka + 30ml kahlua
  d('ck-negroni',          'Negroni',                 '🍹', 'cocktail', 30.0,  90),  // 30ml each gin+vermouth+campari
  d('ck-aperol-spritz',    'Aperol Spritz',           '🍹', 'cocktail', 11.0,  60),  // 60ml aperol
  d('ck-long-island',      'Long Island Iced Tea',    '🍹', 'cocktail', 40.0, 150),  // 30ml x5 spirits
  d('ck-moscow-mule',      'Moscow Mule',             '🍹', 'cocktail', 40.0,  30),  // 30ml vodka
  d('ck-pina-colada',      'Piña Colada',             '🍹', 'cocktail', 40.0,  30),  // 30ml rum
  d('ck-daiquiri',         'Daiquiri',                '🍹', 'cocktail', 40.0,  60),  // 60ml rum
  d('ck-cosmopolitan',     'Cosmopolitan',            '🍹', 'cocktail', 40.0,  60),  // 30ml vodka + 30ml triple sec
  d('ck-whiskey-sour',     'Whiskey Sour',            '🍹', 'cocktail', 40.0,  60),  // 60ml whiskey
  d('ck-mai-tai',          'Mai Tai',                 '🍹', 'cocktail', 40.0,  60),  // 60ml rum
  d('ck-picante',          'Picante',                 '🍹', 'cocktail', 40.0,  60),  // 60ml tequila + chilli
  d('ck-manhattan',        'Manhattan',               '🍹', 'cocktail', 35.0,  90),  // 60ml whiskey + 30ml vermouth
  d('ck-martini',          'Martini',                 '🍹', 'cocktail', 38.0,  75),  // 60ml gin + 15ml vermouth
  d('ck-dirty-martini',    'Dirty Martini',           '🍹', 'cocktail', 35.0,  75),  // 60ml gin/vodka + olive brine
  d('ck-pornstar-martini', 'Pornstar Martini',        '🍹', 'cocktail', 25.0,  90),  // 30ml vodka + 30ml passoa + juice
  d('ck-french-75',        'French 75',               '🍹', 'cocktail', 20.0, 120),  // 30ml gin + 90ml champagne
  d('ck-paloma',           'Paloma',                  '🍹', 'cocktail', 40.0,  60),  // 60ml tequila + grapefruit
  d('ck-tom-collins',      'Tom Collins',             '🍹', 'cocktail', 40.0,  60),  // 60ml gin + soda
  d('ck-gin-fizz',         'Gin Fizz',                '🍹', 'cocktail', 40.0,  60),  // 60ml gin + soda
  d('ck-gimlet',           'Gimlet',                  '🍹', 'cocktail', 40.0,  60),  // 60ml gin + lime
  d('ck-sidecar',          'Sidecar',                 '🍹', 'cocktail', 35.0,  75),  // 45ml cognac + 30ml triple sec
  d('ck-boulevardier',     'Boulevardier',            '🍹', 'cocktail', 30.0,  90),  // 30ml each whiskey+vermouth+campari
  d('ck-paper-plane',      'Paper Plane',             '🍹', 'cocktail', 30.0, 120),  // 30ml each bourbon+aperol+amaro+lemon
  d('ck-penicillin',       'Penicillin',              '🍹', 'cocktail', 40.0,  60),  // 60ml scotch + honey ginger
  d('ck-sazerac',          'Sazerac',                 '🍹', 'cocktail', 45.0,  60),  // 60ml rye + absinthe wash
  d('ck-mint-julep',       'Mint Julep',              '🍹', 'cocktail', 40.0,  60),  // 60ml bourbon
  d('ck-vesper',           'Vesper',                  '🍹', 'cocktail', 38.0,  90),  // 60ml gin + 15ml vodka + 15ml lillet
  d('ck-last-word',        'Last Word',               '🍹', 'cocktail', 30.0, 120),  // 30ml each gin+chartreuse+maraschino+lime
  d('ck-aviation',         'Aviation',                '🍹', 'cocktail', 35.0,  75),  // 60ml gin + maraschino + crème de violette
  d('ck-bramble',          'Bramble',                 '🍹', 'cocktail', 40.0,  60),  // 60ml gin + blackberry
  d('ck-dark-n-stormy',    'Dark \'n\' Stormy',       '🍹', 'cocktail', 40.0,  60),  // 60ml dark rum + ginger beer
  d('ck-caipirinha',       'Caipirinha',              '🍹', 'cocktail', 40.0,  60),  // 60ml cachaça
  d('ck-amaretto-sour',    'Amaretto Sour',           '🍹', 'cocktail', 28.0,  60),  // 60ml amaretto
  d('ck-tequila-sunrise',  'Tequila Sunrise',         '🍹', 'cocktail', 40.0,  60),  // 60ml tequila + OJ + grenadine
  d('ck-sex-on-beach',     'Sex on the Beach',        '🍹', 'cocktail', 25.0,  90),  // 30ml vodka + 30ml peach + juices
  d('ck-bloody-mary',      'Bloody Mary',             '🍹', 'cocktail', 40.0,  60),  // 60ml vodka + tomato
  d('ck-screwdriver',      'Screwdriver',             '🍹', 'cocktail', 40.0,  60),  // 60ml vodka + OJ
  d('ck-white-russian',    'White Russian',           '🍹', 'cocktail', 25.0,  90),  // 30ml vodka + 30ml kahlúa + cream
  d('ck-black-russian',    'Black Russian',           '🍹', 'cocktail', 30.0,  60),  // 30ml vodka + 30ml kahlúa
  d('ck-irish-coffee',     'Irish Coffee',            '🍹', 'cocktail', 40.0,  45),  // 45ml whiskey + coffee
  d('ck-zombie',           'Zombie',                  '🍹', 'cocktail', 40.0, 120),  // multiple rums
  d('ck-hurricane',        'Hurricane',               '🍹', 'cocktail', 40.0,  90),  // 60ml rum + 30ml passion fruit
  d('ck-singapore-sling',  'Singapore Sling',         '🍹', 'cocktail', 25.0, 120),  // 30ml gin + cherry brandy + juices
  d('ck-rum-punch',        'Rum Punch',               '🍹', 'cocktail', 40.0,  60),  // 60ml rum + juices
  d('ck-corpse-reviver',   'Corpse Reviver No. 2',    '🍹', 'cocktail', 30.0, 120),  // 30ml each gin+lillet+cointreau+lemon
  d('ck-tommy-margarita',  'Tommy\'s Margarita',      '🍹', 'cocktail', 40.0,  60),  // 60ml tequila + agave + lime
  d('ck-mezcal-negroni',   'Mezcal Negroni',          '🍹', 'cocktail', 30.0,  90),  // 30ml each mezcal+vermouth+campari
  d('ck-spritz',           'Hugo Spritz',             '🍹', 'cocktail',  8.0, 150),  // elderflower + prosecco + soda
  d('ck-bellini',          'Bellini',                 '🍹', 'cocktail', 10.0, 150),  // prosecco + peach
  d('ck-mimosa',           'Mimosa',                  '🍹', 'cocktail', 10.0, 150),  // champagne + OJ
  d('ck-kir-royale',       'Kir Royale',              '🍹', 'cocktail', 12.0, 150),  // champagne + crème de cassis
  d('ck-liiit',            'LIIT',                    '🍹', 'cocktail', 40.0, 150),  // 30ml x5 spirits

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
  d('shot-limoncello',     'Limoncello',              '🥂', 'shot', 28.0,  30),
  d('shot-goldschlager',   'Goldschläger',            '🥂', 'shot', 43.5,  30),
  d('shot-patron-cafe',    'Patrón XO Cafe',          '🥂', 'shot', 35.0,  30),
  d('shot-amaretto',       'Amaretto',                '🥂', 'shot', 28.0,  30),
  d('shot-fernet',         'Fernet-Branca',           '🥂', 'shot', 39.0,  30),
  d('shot-malort',         'Malört',                  '🥂', 'shot', 35.0,  30),
  d('shot-ouzo',           'Ouzo',                    '🥂', 'shot', 40.0,  30),
  d('shot-grappa',         'Grappa',                  '🥂', 'shot', 40.0,  30),

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
  d('cider-berry',         'Berry Cider',             '🍏', 'cider', 4.5, 330),
  d('cider-strongbow',     'Strongbow',               '🍏', 'cider', 5.0, 330),
  d('cider-magners',       'Magners',                 '🍏', 'cider', 4.5, 330),
  d('cider-bulmers',       'Bulmers',                 '🍏', 'cider', 4.5, 330),
  d('seltzer-hard',        'Hard Seltzer',            '🫧', 'seltzer', 5.0, 330),
  d('seltzer-lemonade',    'Spiked Lemonade',         '🫧', 'seltzer', 5.0, 330),
  d('seltzer-white-claw',  'White Claw',              '🫧', 'seltzer', 5.0, 355),
  d('seltzer-truly',       'Truly',                   '🫧', 'seltzer', 5.0, 355),
  d('seltzer-breezer',     'Bacardi Breezer',         '🫧', 'seltzer', 4.8, 275),
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
