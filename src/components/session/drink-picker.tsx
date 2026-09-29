'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Search, X, Plus, ChevronLeft, Star, Clock } from 'lucide-react';
import { calculateStandardDrinks } from '@/lib/utils';
import { DRINK_CATEGORY_COLORS } from '@/lib/constants';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { useAuthStore } from '@/stores/use-auth-store';
import {
  useDrinkPrefsStore,
  selectPrefs,
  selectRecents,
  selectFavorites,
  selectCost,
  quickDrinkFromEntry,
} from '@/stores/use-drink-prefs-store';
import {
  PICKER_CATEGORIES,
  buildDefinitionIndex,
  customDrinkToDefinition,
  entryFromCustomDrink,
  entryFromDefinition,
  fetchCustomDrinks,
  filterPickerDrinks,
  resolveQuickDrink,
  saveCustomDrink,
  validateCustomDrink,
  type PickerCategory,
} from '@/lib/drink-picker';
import { formatCost, parseCost, currencySymbol, MAX_DRINK_COST } from '@/lib/money';
import { hapticMedium, hapticSelection, hapticLight } from '@/lib/haptics';
import type { DrinkEntry, DrinkDefinition } from '@/types';

interface DrinkPickerProps {
  onSelect: (drink: DrinkEntry) => void;
  onClose: () => void;
}

export function DrinkPicker({ onSelect, onClose }: DrinkPickerProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PickerCategory>('all');
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAbv, setCustomAbv] = useState('5');
  const [customVol, setCustomVol] = useState('330');
  const [customDrinks, setCustomDrinks] = useState<DrinkDefinition[]>([]);
  const [customError, setCustomError] = useState<string | null>(null);
  const currentUser = useAuthStore((s) => s.currentUser);
  const userId = currentUser?.id;

  // Subscribe to the stable slices and derive with useMemo — calling a store
  // getter inside the selector would hand useSyncExternalStore a new array on
  // every render.
  const prefsByUser = useDrinkPrefsStore((s) => s.byUser);
  const currency = useDrinkPrefsStore((s) => s.currency);
  const recordUse = useDrinkPrefsStore((s) => s.recordUse);
  const toggleFavorite = useDrinkPrefsStore((s) => s.toggleFavorite);
  const setStoredCost = useDrinkPrefsStore((s) => s.setCost);

  const prefs = useMemo(() => selectPrefs(prefsByUser, userId), [prefsByUser, userId]);
  const recentDrinks = useMemo(() => selectRecents(prefs, 8), [prefs]);
  const favoriteDrinks = useMemo(() => selectFavorites(prefs), [prefs]);
  const favoriteIds = useMemo(() => new Set(prefs.favoriteIds), [prefs.favoriteIds]);

  // Which drink's price is being edited, plus the in-flight text value.
  const [pricingId, setPricingId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');

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
    fetchCustomDrinks(currentUser.id).then((drinks) => {
      if (drinks) setCustomDrinks(drinks);
    });
  }, [currentUser]);

  // Canonical definition per id: prefer the live library/custom row so an
  // edited ABV or volume wins over the snapshot stored in recents.
  const definitionById = useMemo(() => buildDefinitionIndex(customDrinks), [customDrinks]);

  const drinks = useMemo(
    () =>
      filterPickerDrinks({
        query,
        category,
        customDrinks,
        favorites: favoriteDrinks.map((q) => resolveQuickDrink(q, definitionById)),
      }),
    [query, category, customDrinks, favoriteDrinks, definitionById],
  );

  // The pinned Recent strip only makes sense on the unfiltered default view;
  // once you search or pick a category you asked for something specific.
  const showRecents = !query.trim() && category === 'all' && recentDrinks.length > 0;

  const handleSelect = (def: DrinkDefinition) => {
    hapticMedium();
    const entry = entryFromDefinition(def, selectCost(prefs, def.id));
    if (userId) recordUse(userId, quickDrinkFromEntry(entry));
    onSelect(entry);
  };

  const openPricing = (definitionId: string) => {
    hapticLight();
    const existing = selectCost(prefs, definitionId);
    setPriceDraft(existing === null ? '' : String(existing));
    setPricingId(definitionId);
  };

  const commitPricing = () => {
    if (!pricingId || !userId) return;
    // Empty input clears the remembered price; anything unparseable is
    // rejected by the disabled state, so this is always well-formed.
    setStoredCost(userId, pricingId, priceDraft.trim() === '' ? null : parseCost(priceDraft));
    setPricingId(null);
    setPriceDraft('');
  };

  const priceDraftValid =
    priceDraft.trim() === '' || parseCost(priceDraft) !== null;

  const handleCustomDrink = async () => {
    if (!currentUser) return;
    const err = validateCustomDrink(customName, customAbv, customVol);
    if (err) {
      setCustomError(err);
      return;
    }
    setCustomError(null);
    const drink = {
      name: customName.trim(),
      abvPercent: parseFloat(customAbv),
      volumeMl: parseFloat(customVol),
    };

    // Save to Supabase for future use
    const saved = await saveCustomDrink(currentUser.id, drink);
    if (saved) setCustomDrinks((prev) => [customDrinkToDefinition(saved), ...prev]);

    // Select it immediately
    const entry: DrinkEntry = entryFromCustomDrink(saved, drink);
    if (userId) recordUse(userId, quickDrinkFromEntry(entry));
    onSelect(entry);
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
        style={{ background: 'var(--sheet-solid-bg)', height: '92dvh', maxHeight: '92dvh' }}
      >
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none"
        >
          <div className="w-10 h-1.5 rounded-full bg-[var(--grabber-bg)]" />
        </div>

        {showCustom ? (
          <div className="flex-1 flex flex-col px-5">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setShowCustom(false)} className="p-2 -ml-2 active:text-foreground">
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
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
                className="w-full px-4 py-3 rounded-xl bg-surface-subtle border border-card-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-muted mb-1 block">ABV %</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={customAbv}
                    onChange={(e) => { setCustomAbv(e.target.value); setCustomError(null); }}
                    className="w-full px-4 py-3 rounded-xl bg-surface-subtle border border-card-border text-sm text-foreground focus:outline-none focus:border-accent/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted mb-1 block">Volume (ml)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={customVol}
                    onChange={(e) => { setCustomVol(e.target.value); setCustomError(null); }}
                    className="w-full px-4 py-3 rounded-xl bg-surface-subtle border border-card-border text-sm text-foreground focus:outline-none focus:border-accent/40"
                  />
                </div>
              </div>
              <p className="text-xs text-muted text-center">
                ={' '}
                <span className="font-bold text-foreground">
                  {customValidationError === null
                    ? calculateStandardDrinks(parseFloat(customVol), parseFloat(customAbv))
                    : '—'}
                </span>{' '}
                standard drinks
              </p>
              <p className="text-[10px] text-fg-faint text-center">This drink will be saved to your list</p>
              {customError && (
                <p className="text-xs text-danger-fg text-center" role="alert">{customError}</p>
              )}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCustomDrink}
                disabled={customValidationError !== null}
                className="w-full py-3.5 rounded-xl bg-accent text-accent-foreground font-bold text-sm disabled:opacity-20"
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
                <button onClick={onClose} className="p-2.5 -mr-2.5 rounded-lg hover:bg-surface-subtle active:bg-surface-strong">
                  <X className="w-4 h-4 text-fg-secondary" />
                </button>
              </div>

              <div className="relative mb-2.5">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search drinks..."
                  enterKeyHint="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-subtle border border-card-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40"
                  autoFocus
                />
              </div>

              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-5 px-5">
                <div className="flex gap-1.5 min-w-max">
                  {PICKER_CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => { hapticSelection(); setCategory(c.value); setQuery(''); }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap active:scale-[0.97] ${
                        category === c.value
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-surface-secondary text-fg-secondary'
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
              {/* Recent — the one-tap shortcut for what you actually drink */}
              {showRecents && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-fg-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Recent
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recentDrinks.map((quick) => {
                      const def = resolveQuickDrink(quick, definitionById);
                      const cost = selectCost(prefs, quick.definitionId);
                      return (
                        <motion.button
                          key={`recent-${quick.definitionId}`}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleSelect(def)}
                          className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full bg-surface-secondary border border-card-border active:bg-surface-subtle transition-colors"
                        >
                          <DrinkIcon category={def.category} className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium max-w-[120px] truncate">{def.name}</span>
                          {cost !== null && (
                            <span className="text-[10px] text-muted">{formatCost(cost, currency)}</span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowCustom(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl border border-dashed border-card-border active:bg-card"
              >
                <Plus className="w-4 h-4 text-accent" />
                <span className="text-sm text-accent font-medium">Custom Drink</span>
              </button>

              {drinks.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-fg-secondary mb-2">
                    {category === 'favorites' ? 'No starred drinks yet' : 'No results'}
                  </p>
                  {category === 'favorites' ? (
                    <p className="text-xs text-muted">Tap the star on any drink to pin it here</p>
                  ) : (
                    <button onClick={() => setShowCustom(true)} className="text-sm text-accent font-medium">
                      Add as custom
                    </button>
                  )}
                </div>
              ) : (
                drinks.map((drink) => {
                  const color = DRINK_CATEGORY_COLORS[drink.category] || '#71717a';
                  const isCustom = drink.id.startsWith('custom-');
                  const isFavorite = favoriteIds.has(drink.id);
                  const cost = selectCost(prefs, drink.id);
                  return (
                    <div
                      key={drink.id}
                      className="w-full flex items-center gap-1 rounded-xl active:bg-surface-subtle transition-colors"
                    >
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelect(drink)}
                        className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2 text-left"
                      >
                        <span className="w-7 flex items-center justify-center shrink-0"><DrinkIcon category={drink.category} className="w-5 h-5" /></span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {drink.name}
                            {isCustom && <span className="text-[10px] text-muted ml-1.5">custom</span>}
                          </p>
                          <p className="text-[10px] text-muted">
                            {drink.defaultAbvPercent}% · {drink.defaultVolumeMl}ml · <span style={{ color }}>{drink.standardDrinks} std</span>
                          </p>
                        </div>
                      </motion.button>

                      {/* Remembered price — set once, auto-attaches every log after */}
                      <button
                        onClick={() => openPricing(drink.id)}
                        aria-label={
                          cost === null
                            ? `Set price for ${drink.name}`
                            : `Change price for ${drink.name}, currently ${formatCost(cost, currency)}`
                        }
                        className={`shrink-0 h-7 min-w-[28px] px-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          cost === null
                            ? 'text-fg-faint active:bg-surface-subtle'
                            : 'bg-surface-secondary text-muted-foreground active:bg-surface-subtle'
                        }`}
                      >
                        {cost === null ? currencySymbol(currency) : formatCost(cost, currency)}
                      </button>

                      <button
                        onClick={() => {
                          if (!userId) return;
                          hapticSelection();
                          toggleFavorite(userId, drink.id);
                        }}
                        aria-label={isFavorite ? `Unstar ${drink.name}` : `Star ${drink.name}`}
                        aria-pressed={isFavorite}
                        className="shrink-0 w-8 h-8 mr-1 rounded-lg flex items-center justify-center active:bg-surface-subtle transition-colors"
                      >
                        <Star
                          className={`w-4 h-4 ${isFavorite ? 'text-accent' : 'text-fg-faint'}`}
                          fill={isFavorite ? 'currentColor' : 'none'}
                        />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Price editor — anchored inside the sheet so the list stays put */}
            {pricingId && (
              <div
                className="absolute inset-x-0 bottom-0 px-5 pt-4 pb-6 border-t"
                style={{ background: 'var(--sheet-solid-bg)', borderColor: 'var(--chrome-border)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Price per drink</p>
                  <button
                    onClick={() => { setPricingId(null); setPriceDraft(''); }}
                    aria-label="Cancel"
                    className="p-2 -mr-2 rounded-lg active:bg-surface-subtle"
                  >
                    <X className="w-4 h-4 text-fg-secondary" />
                  </button>
                </div>
                <p className="text-[11px] text-muted mb-2.5">
                  Remembered on this device and attached automatically next time.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                      {currencySymbol(currency)}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={MAX_DRINK_COST}
                      value={priceDraft}
                      onChange={(e) => setPriceDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && priceDraftValid) commitPricing();
                      }}
                      placeholder="Leave blank to clear"
                      autoFocus
                      className="w-full pl-8 pr-4 py-3 rounded-xl bg-surface-subtle border border-card-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40"
                    />
                  </div>
                  <button
                    onClick={commitPricing}
                    disabled={!priceDraftValid}
                    className="px-5 rounded-xl bg-accent text-accent-foreground font-bold text-sm disabled:opacity-30"
                  >
                    Save
                  </button>
                </div>
                {!priceDraftValid && (
                  <p className="text-[11px] text-danger-fg mt-2" role="alert">
                    Enter an amount between 0 and {MAX_DRINK_COST.toLocaleString('en-US')}.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
