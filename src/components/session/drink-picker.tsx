'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Search, X, Plus, ChevronLeft } from 'lucide-react';
import { DRINK_LIBRARY, getDrinksByCategory, searchDrinks } from '@/lib/data/drink-library';
import { calculateStandardDrinks, splitOversizedDrink } from '@/lib/utils';
import { DRINK_CATEGORY_COLORS } from '@/lib/constants';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/use-auth-store';
import { hapticMedium, hapticSelection } from '@/lib/haptics';
import type { DrinkCategory, DrinkEntry, DrinkDefinition } from '@/types';

const CATEGORIES: { value: DrinkCategory | 'all' | 'custom'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'custom', label: 'My Drinks' },
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

interface CustomDrinkRow {
  id: string;
  name: string;
  emoji: string;
  category: string;
  abv_percent: number;
  volume_ml: number;
}

interface DrinkPickerProps {
  onSelect: (drink: DrinkEntry) => void;
  onClose: () => void;
}

function validateCustomDrink(name: string, abvStr: string, volStr: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give your drink a name.';
  if (trimmed.length > 60) return 'Name is too long (max 60 chars).';
  const abv = parseFloat(abvStr);
  if (!Number.isFinite(abv) || abv < 0.1 || abv > 80) {
    return 'ABV must be between 0.1% and 80%.';
  }
  const vol = parseFloat(volStr);
  if (!Number.isFinite(vol) || vol < 10 || vol > 2000) {
    return 'Volume must be between 10 and 2000 ml.';
  }
  return null;
}

export function DrinkPicker({ onSelect, onClose }: DrinkPickerProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DrinkCategory | 'all' | 'custom'>('all');
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAbv, setCustomAbv] = useState('5');
  const [customVol, setCustomVol] = useState('330');
  const [customDrinks, setCustomDrinks] = useState<DrinkDefinition[]>([]);
  const [customError, setCustomError] = useState<string | null>(null);
  const currentUser = useAuthStore((s) => s.currentUser);

  const customValidationError = validateCustomDrink(customName, customAbv, customVol);

  const dragControls = useDragControls();

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Fetch user's custom drinks
  useEffect(() => {
    if (!currentUser) return;
    supabase
      .from('custom_drinks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setCustomDrinks(
            (data as CustomDrinkRow[]).map((d) => ({
              id: `custom-${d.id}`,
              name: d.name,
              emoji: d.emoji,
              category: d.category as DrinkCategory,
              defaultAbvPercent: d.abv_percent,
              defaultVolumeMl: d.volume_ml,
              standardDrinks: calculateStandardDrinks(d.volume_ml, d.abv_percent),
              color: '#71717a',
              isCustom: true,
            }))
          );
        }
      });
  }, [currentUser]);

  const drinks = useMemo(() => {
    const allDrinks = [...customDrinks, ...DRINK_LIBRARY];
    if (query.trim()) {
      const q = query.toLowerCase();
      return allDrinks.filter((d) => d.name.toLowerCase().includes(q));
    }
    if (category === 'all') return allDrinks;
    if (category === 'custom') return customDrinks;
    return getDrinksByCategory(category as DrinkCategory);
  }, [query, category, customDrinks]);

  const handleSelect = (def: DrinkDefinition) => {
    hapticMedium();
    const entry: DrinkEntry = {
      id: crypto.randomUUID(),
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
    };
    for (const sub of splitOversizedDrink(entry)) onSelect(sub);
  };

  const handleCustomDrink = async () => {
    if (!currentUser) return;
    const err = validateCustomDrink(customName, customAbv, customVol);
    if (err) {
      setCustomError(err);
      return;
    }
    setCustomError(null);
    const abv = parseFloat(customAbv);
    const vol = parseFloat(customVol);
    const trimmedName = customName.trim();

    // Save to Supabase for future use
    const { data: inserted } = await supabase
      .from('custom_drinks')
      .insert({
        user_id: currentUser.id,
        name: trimmedName,
        emoji: '🍸',
        category: 'custom',
        abv_percent: abv,
        volume_ml: vol,
      })
      .select()
      .single();

    // Add to local custom drinks list
    if (inserted) {
      const row = inserted as CustomDrinkRow;
      setCustomDrinks((prev) => [
        {
          id: `custom-${row.id}`,
          name: row.name,
          emoji: row.emoji,
          category: row.category as DrinkCategory,
          defaultAbvPercent: row.abv_percent,
          defaultVolumeMl: row.volume_ml,
          standardDrinks: calculateStandardDrinks(row.volume_ml, row.abv_percent),
          color: '#71717a',
          isCustom: true,
        },
        ...prev,
      ]);
    }

    // Select it immediately
    const entry: DrinkEntry = {
      id: crypto.randomUUID(),
      drinkDefinitionId: inserted ? `custom-${(inserted as CustomDrinkRow).id}` : `custom-${crypto.randomUUID()}`,
      drinkName: trimmedName,
      emoji: '🍸',
      category: 'custom' as DrinkCategory,
      abvPercent: abv,
      volumeMl: vol,
      standardDrinks: calculateStandardDrinks(vol, abv),
      timestamp: new Date().toISOString(),
      roundId: null,
      notes: '',
    };
    for (const sub of splitOversizedDrink(entry)) onSelect(sub);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60]"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

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
        className="absolute bottom-0 left-0 right-0 max-w-lg mx-auto rounded-t-3xl flex flex-col safe-bottom"
        style={{ background: '#111114', height: '92dvh', maxHeight: '92dvh' }}
      >
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none"
        >
          <div className="w-10 h-1.5 rounded-full bg-white/20" />
        </div>

        {showCustom ? (
          <div className="flex-1 flex flex-col px-5">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setShowCustom(false)} className="p-2 -ml-2 active:text-white">
                <ChevronLeft className="w-5 h-5 text-zinc-400" />
              </button>
              <h2 className="text-base font-bold">Custom Drink</h2>
            </div>
            <div className="space-y-3">
              <input
                value={customName}
                onChange={(e) => { setCustomName(e.target.value); setCustomError(null); }}
                placeholder="What are you drinking?"
                autoFocus
                autoCapitalize="words"
                enterKeyHint="done"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-zinc-600 mb-1 block">ABV %</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={customAbv}
                    onChange={(e) => { setCustomAbv(e.target.value); setCustomError(null); }}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-sm text-white focus:outline-none focus:border-accent/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-600 mb-1 block">Volume (ml)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={customVol}
                    onChange={(e) => { setCustomVol(e.target.value); setCustomError(null); }}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-sm text-white focus:outline-none focus:border-accent/40"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-600 text-center">
                ={' '}
                <span className="font-bold text-white">
                  {customValidationError === null
                    ? calculateStandardDrinks(parseFloat(customVol), parseFloat(customAbv))
                    : '—'}
                </span>{' '}
                standard drinks
              </p>
              <p className="text-[10px] text-zinc-700 text-center">This drink will be saved to your list</p>
              {customError && (
                <p className="text-xs text-red-400 text-center" role="alert">{customError}</p>
              )}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCustomDrink}
                disabled={customValidationError !== null}
                className="w-full py-3.5 rounded-xl bg-accent text-black font-bold text-sm disabled:opacity-20"
              >
                Add Drink
              </motion.button>
            </div>
          </div>
        ) : (
          <>
            <div className="shrink-0 px-5 pb-2.5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold">Add Drink</h2>
                <button onClick={onClose} className="p-2.5 -mr-2.5 rounded-lg hover:bg-white/5 active:bg-white/[0.08]">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <div className="relative mb-2.5">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search drinks..."
                  enterKeyHint="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40"
                  autoFocus
                />
              </div>

              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-5 px-5">
                <div className="flex gap-1.5 min-w-max">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => { hapticSelection(); setCategory(c.value); setQuery(''); }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap active:scale-[0.97] ${
                        category === c.value
                          ? 'bg-accent text-black'
                          : 'bg-white/[0.04] text-zinc-500'
                      }`}
                    >
                      {c.label}
                      {c.value === 'custom' && customDrinks.length > 0 ? ` (${customDrinks.length})` : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-2 pb-20" style={{ overscrollBehaviorY: 'contain' }}>
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
                  const isCustom = drink.id.startsWith('custom-');
                  return (
                    <motion.button
                      key={drink.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelect(drink)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl active:bg-white/[0.05] transition-colors text-left"
                    >
                      <span className="w-7 flex items-center justify-center shrink-0"><DrinkIcon category={drink.category} className="w-5 h-5" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {drink.name}
                          {isCustom && <span className="text-[10px] text-zinc-600 ml-1.5">custom</span>}
                        </p>
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
