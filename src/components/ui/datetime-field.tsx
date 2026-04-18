'use client';

import { Calendar } from 'lucide-react';
import { isoToLocalInputValue, localInputValueToIso } from '@/lib/session-utils';

interface DateTimeFieldProps {
  label: string;
  value: string; // ISO
  onChange: (iso: string) => void;
  max?: string; // ISO (e.g. "now")
  min?: string; // ISO
}

// Thin wrapper around <input type="datetime-local"> styled to match the
// rest of the app (matches the text input treatment in session/page.tsx).
// Native picker means iOS gets the wheel, Android gets the modal, zero deps.
export function DateTimeField({ label, value, onChange, max, min }: DateTimeFieldProps) {
  const inputValue = value ? isoToLocalInputValue(value) : '';
  const maxLocal = max ? isoToLocalInputValue(max) : undefined;
  const minLocal = min ? isoToLocalInputValue(min) : undefined;

  return (
    <label className="block min-w-0">
      <span className="text-[11px] text-zinc-500 mb-1.5 block">{label}</span>
      <div className="relative min-w-0">
        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
        <input
          type="datetime-local"
          value={inputValue}
          max={maxLocal}
          min={minLocal}
          onChange={(e) => {
            if (!e.target.value) return;
            onChange(localInputValueToIso(e.target.value));
          }}
          style={{ minWidth: 0 }}
          className="block w-full max-w-full box-border pl-12 pr-3 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-[13px] text-white focus:outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
        />
      </div>
    </label>
  );
}
