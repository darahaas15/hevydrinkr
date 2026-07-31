/**
 * Money helpers for optional per-drink cost tracking.
 *
 * Cost is always stored as a plain number in the user's chosen currency —
 * there is no FX conversion and no minor-unit encoding. The currency is a
 * device-local display preference (see `use-drink-prefs-store`), so changing
 * it re-labels existing numbers rather than converting them. That is the
 * honest behaviour for a single-user, single-region ledger and avoids
 * pretending to a precision we don't have.
 */

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

/** Supported display currencies. `code` is the persisted value. */
export const CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', label: 'Rupee' },
  { code: 'USD', symbol: '$', label: 'Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'Pound' },
  { code: 'AUD', symbol: 'A$', label: 'Aus dollar' },
  { code: 'SGD', symbol: 'S$', label: 'Sing dollar' },
];

export const DEFAULT_CURRENCY = 'INR';

/** Largest accepted price for a single drink. Guards fat-finger entry. */
export const MAX_DRINK_COST = 100_000;

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? '₹';
}

/**
 * Parse free-text price input into a number.
 * Returns null for empty/whitespace input (meaning "no price recorded"),
 * and null for anything non-finite, negative, or above MAX_DRINK_COST.
 * Strips currency symbols, spaces, and thousands separators so pasted
 * values like "₹1,250" work.
 */
export function parseCost(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (cleaned.trim() === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  if (value < 0 || value > MAX_DRINK_COST) return null;
  // Round to 2dp so float noise never reaches the DB or the totals.
  return Math.round(value * 100) / 100;
}

/**
 * Format an amount for display. Whole numbers render without decimals
 * (₹250, not ₹250.00) because bar prices are almost always round, and
 * thousands get grouped for legibility on the spend totals.
 */
export function formatCost(amount: number, currencyCode: string): string {
  const symbol = currencySymbol(currencyCode);
  const rounded = Math.round(amount * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0.001;
  // Group thousands in both branches — mixing grouped whole amounts with
  // ungrouped fractional ones reads as a bug in a column of totals.
  const body = rounded.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
  return `${symbol}${body}`;
}

/**
 * Sum the recorded costs of a set of drinks.
 * Returns null when NO drink carries a price, so callers can distinguish
 * "this session cost nothing" from "no prices were entered" and hide the
 * spend UI entirely in the latter case.
 */
export function sumCosts(drinks: { cost?: number | null }[]): number | null {
  let total = 0;
  let any = false;
  for (const d of drinks) {
    if (typeof d.cost === 'number' && Number.isFinite(d.cost)) {
      total += d.cost;
      any = true;
    }
  }
  if (!any) return null;
  return Math.round(total * 100) / 100;
}
