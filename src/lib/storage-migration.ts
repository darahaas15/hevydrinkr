import { STORAGE_KEYS } from '@/lib/constants';

const OLD_PREFIX = 'hevydrinkr-';
const NEW_PREFIX = 'drinkr-';

export function migrateStorageKeys(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(STORAGE_KEYS.AUTH)) return;

  for (const key of Object.values(STORAGE_KEYS)) {
    const oldKey = key.replace(NEW_PREFIX, OLD_PREFIX);
    const value = localStorage.getItem(oldKey);
    if (value) {
      localStorage.setItem(key, value);
      localStorage.removeItem(oldKey);
    }
  }
}
