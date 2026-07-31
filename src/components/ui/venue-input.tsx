'use client';

import { useState, useMemo, useRef, useId } from 'react';
import { MapPin } from 'lucide-react';
import { suggestVenues, type VenueStat } from '@/lib/venues';
import { hapticSelection } from '@/lib/haptics';

interface VenueInputProps {
  value: string;
  onChange: (value: string) => void;
  /** The user's venue history, from `useVenueStats()`. */
  venues: VenueStat[];
  placeholder?: string;
  className?: string;
  /** Override the leading icon size to match the surrounding form. */
  iconClassName?: string;
  autoFocus?: boolean;
  /** Fired on Enter when no suggestion is being picked. */
  onSubmit?: () => void;
  'aria-label'?: string;
}

/**
 * Venue text field with autocomplete over the user's own past venues.
 *
 * Free text is still the source of truth — the suggestions only exist so the
 * same bar stops fragmenting into "Toit" / "toit" / "Toit ". Picking a
 * suggestion adopts its exact spelling.
 */
export function VenueInput({
  value,
  onChange,
  venues,
  placeholder = 'Where are you drinking?',
  className,
  iconClassName = 'w-5 h-5',
  autoFocus,
  onSubmit,
  'aria-label': ariaLabel,
}: VenueInputProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const suggestions = useMemo(
    () => suggestVenues(venues, value),
    [venues, value],
  );
  const showList = open && suggestions.length > 0;

  const pick = (name: string) => {
    hapticSelection();
    onChange(name);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 ${iconClassName} text-muted pointer-events-none`} />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-label={ariaLabel ?? 'Venue'}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Blur closes the list. Suggestion buttons suppress blur via
        // onPointerDown preventDefault, so a tap still registers as a click.
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (e.key === 'Enter') {
            setOpen(false);
            onSubmit?.();
          }
        }}
        placeholder={placeholder}
        autoCapitalize="words"
        autoComplete="off"
        enterKeyHint={onSubmit ? 'go' : 'done'}
        autoFocus={autoFocus}
        className={
          className ??
          'w-full pl-12 pr-4 py-4 rounded-2xl bg-surface-secondary border border-card-border text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors'
        }
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1.5 rounded-2xl overflow-hidden border border-card-border shadow-lg"
          style={{ background: 'var(--popover-strong-bg)' }}
        >
          {suggestions.map((venue) => (
            <li key={venue.key} role="option" aria-selected={false}>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(venue.name)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-surface-subtle transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
                <span className="text-sm truncate flex-1">{venue.name}</span>
                <span className="text-[10px] text-muted shrink-0">
                  {venue.visits}×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
