'use client';

import { useState, useMemo } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Search, X, Plus, ChevronLeft } from 'lucide-react';
import { DRINK_LIBRARY, getDrinksByCategory, searchDrinks } from '@/lib/data/drink-library';
import { generateId, calculateStandardDrinks } from '@/lib/utils';
import { DRINK_CATEGORY_COLORS } from '@/lib/constants';
import type { DrinkCategory, DrinkEntry, DrinkDefinition } from '@/types';

const CATEGORIES: { value: DrinkCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'beer', label: 'Beer' },
  { value: 'whiskey', label: 'Whiskey' },
  { value: 'vodka', label: 'Vodka' },
  { value: 'rum', label: 'Rum' },
  { value: 'gin', label: 'Gin' },
  { value: 'brandy', label: 'Brandy' },
  { value: 'tequila', label: 'Tequila' },
  { value: 'wine', label: 'Wine' },
  { value: 'cocktail', label: 'Cocktails' },
  { value: 'shot', label: 'Shots' },
  { value: 'desi', label: 'Desi' },
];

interface DrinkPickerProps {
  onSelect: (drink: DrinkEntry) => void;
  onClose: () => void;
}

export function DrinkPicker({ onSelect, onClose }: DrinkPickerProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DrinkCategory | 'all'>('all');
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAbv, setCustomAbv] = useState('5');
  const [customVol, setCustomVol] = useState('330');

  const dragControls = useDragControls();

  const drinks = useMemo(() => {
    if (query.trim()) return searchDrinks(query);
    if (category === 'all') return DRINK_LIBRARY;
    return getDrinksByCategory(category);
  }, [query, category]);

  const handleSelect = (def: DrinkDefinition) => {
    onSelect({
      id: generateId(),
      drinkDefinitionId: def.id,
      drinkName: def.name,
      emoji: def.emoji,
      category: def.category,
      abvPercent: def.defaultAbvPercent,
      volumeMl: def.defaultVolumeMl,
      standardDrinks: calculateStandardDrinks(def.defaultVolumeMl, def.defaultAbvPercent),
      timestamp: new Date().toISOString(),
      roundId: null,
      notes: '',
    });
  };

  const handleCustomDrink = () => {
    if (!customName.trim()) return;
    const abv = parseFloat(customAbv) || 5;
    const vol = parseFloat(customVol) || 330;
    onSelect({
      id: generateId(),
      drinkDefinitionId: 'custom-' + generateId(),
      drinkName: customName.trim(),
      emoji: '🍸',
      category: 'custom',
      abvPercent: abv,
      volumeMl: vol,
      standardDrinks: calculateStandardDrinks(vol, abv),
      timestamp: new Date().toISOString(),
      roundId: null,
      notes: '',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60]"
    >
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom sheet — drag to dismiss */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 500) onClose();
        }}
        className="absolute bottom-0 left-0 right-0 max-w-lg mx-auto rounded-t-3xl flex flex-col"
        style={{ background: '#111114', height: '92vh', maxHeight: '92vh' }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none"
        >
          <div className="w-10 h-1.5 rounded-full bg-white/20" />
        </div>

        {showCustom ? (
          /* ── Custom drink form ── */
          <div className="flex-1 flex flex-col px-5">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setShowCustom(false)} className="p-1 -ml-1">
                <ChevronLeft className="w-5 h-5 text-zinc-400" />
              </button>
              <h2 className="text-base font-bold">Custom Drink</h2>
            </div>
            <div className="space-y-3 flex-1">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="What are you drinking?"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-zinc-600 mb-1 block">ABV %</label>
                  <input
                    type="number"
                    value={customAbv}
                    onChange={(e) => setCustomAbv(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-sm text-white focus:outline-none focus:border-accent/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-600 mb-1 block">Volume (ml)</label>
                  <input
                    type="number"
                    value={customVol}
                    onChange={(e) => setCustomVol(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-sm text-white focus:outline-none focus:border-accent/40"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-600 text-center">
                = <span className="font-bold text-white">{calculateStandardDrinks(parseFloat(customVol) || 0, parseFloat(customAbv) || 0)}</span> standard drinks
              </p>
            </div>
            <div className="py-4">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCustomDrink}
                disabled={!customName.trim()}
                className="w-full py-3.5 rounded-xl bg-accent text-black font-bold text-sm disabled:opacity-20"
              >
                Add Drink
              </motion.button>
            </div>
          </div>
        ) : (
          /* ── Drink library ── */
          <>
            {/* Search + filters (sticky within sheet) */}
            <div className="shrink-0 px-5 pb-2.5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold">Add Drink</h2>
                <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-lg hover:bg-white/5">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <div className="relative mb-2.5">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search drinks..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40"
                  autoFocus
                />
              </div>

              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-5 px-5">
                <div className="flex gap-1.5 min-w-max">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => { setCategory(c.value); setQuery(''); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        category === c.value
                          ? 'bg-accent text-black'
                          : 'bg-white/[0.04] text-zinc-500'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable drink list */}
            <div className="flex-1 overflow-y-auto px-5 pt-2 pb-20">
              {/* Custom drink row */}
              <button
                onClick={() => setShowCustom(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl border border-dashed border-white/[0.06] active:bg-white/[0.03]"
              >
                <Plus className="w-4 h-4 text-accent" />
                <span className="text-sm text-accent font-medium">Custom Drink</span>
              </button>

              {drinks.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-zinc-500 mb-2">No results</p>
                  <button onClick={() => setShowCustom(true)} className="text-sm text-accent font-medium">
                    Add as custom
                  </button>
                </div>
              ) : (
                drinks.map((drink) => {
                  const color = DRINK_CATEGORY_COLORS[drink.category] || '#71717a';
                  return (
                    <motion.button
                      key={drink.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelect(drink)}
                      className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl active:bg-white/[0.05] transition-colors text-left min-h-[52px]"
                    >
                      <span className="text-xl w-7 text-center shrink-0">{drink.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{drink.name}</p>
                        <p className="text-[10px] text-zinc-600">
                          {drink.defaultAbvPercent}% · {drink.defaultVolumeMl}ml · <span style={{ color }}>{drink.standardDrinks} std</span>
                        </p>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
