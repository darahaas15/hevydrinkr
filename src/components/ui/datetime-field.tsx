'use client';

import { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { isoToLocalInputValue, localInputValueToIso } from '@/lib/session-utils';

interface DateTimeFieldProps {
  label: string;
  value: string; // ISO
  onChange: (iso: string) => void;
  max?: string; // ISO (e.g. "now")
  min?: string; // ISO
}

function formatDisplay(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} at ${time}`;
}

// Native `<input type="datetime-local">` on iOS has an intrinsic min-width
// that ignores `width: 100%`, so we render a styled surface for display and
// overlay a transparent native input sized to the container (absolute inset-0)
// purely to trigger the system picker. This keeps the field inside its row
// on narrow screens.
export function DateTimeField({ label, value, onChange, max, min }: DateTimeFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValue = value ? isoToLocalInputValue(value) : '';
  const maxLocal = max ? isoToLocalInputValue(max) : undefined;
  const minLocal = min ? isoToLocalInputValue(min) : undefined;
  const displayText = value ? formatDisplay(value) : 'Select date & time';

  return (
    <label className="block">
      <span className="text-[11px] text-fg-secondary mb-1.5 block">{label}</span>
      <div className="relative">
        <div className="flex items-center w-full pl-12 pr-4 py-3.5 rounded-2xl bg-surface-secondary border border-card-border text-[13px] text-foreground">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <span className="flex-1 min-w-0 truncate">{displayText}</span>
        </div>
        <input
          ref={inputRef}
          type="datetime-local"
          value={inputValue}
          max={maxLocal}
          min={minLocal}
          onChange={(e) => {
            if (!e.target.value) return;
            onChange(localInputValueToIso(e.target.value));
          }}
          aria-label={label}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </label>
  );
}
