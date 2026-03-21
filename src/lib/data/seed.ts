import { STORAGE_KEYS } from '@/lib/constants';
import { MOCK_USERS, DEMO_USER } from './mock-users';
import { MOCK_SESSIONS } from './mock-sessions';
import { MOCK_FEED } from './mock-feed';
import { MOCK_GROUPS, MOCK_CHALLENGES } from './mock-groups';
import type { PersonalRecord, PRCategory } from '@/types';
import { generateId } from '@/lib/utils';

// ── Zustand-persist helper ──────────────────────────────────

function zustandPersist(state: Record<string, unknown>): string {
  return JSON.stringify({ state, version: 0 });
}

// ── Compute demo user PRs from their sessions ──────────────

function computeDemoPRs(): PersonalRecord[] {
  const demoSessions = MOCK_SESSIONS.filter(
    (s) => s.userId === DEMO_USER.id && s.status === 'completed',
  );
  if (demoSessions.length === 0) return [];

  const prs: PersonalRecord[] = [];

  // Most drinks in a session
  const mostDrinks = demoSessions.reduce((best, s) =>
    s.drinks.length > best.drinks.length ? s : best,
  );
  prs.push(makePR('most_drinks_session', mostDrinks.drinks.length, `${mostDrinks.drinks.length} drinks`, mostDrinks));

  // Most standard drinks
  const mostStandard = demoSessions.reduce((best, s) =>
    s.totalStandardDrinks > best.totalStandardDrinks ? s : best,
  );
  prs.push(makePR('most_standard_drinks', mostStandard.totalStandardDrinks, `${mostStandard.totalStandardDrinks} std`, mostStandard));

  // Longest session
  const longest = demoSessions.reduce((best, s) =>
    s.durationMinutes > best.durationMinutes ? s : best,
  );
  const hrs = Math.floor(longest.durationMinutes / 60);
  const mins = longest.durationMinutes % 60;
  prs.push(makePR('longest_session', longest.durationMinutes, `${hrs}h ${mins}m`, longest));

  // Most unique drinks
  const mostUnique = demoSessions.reduce((best, s) => {
    const unique = new Set(s.drinks.map((d) => d.drinkDefinitionId)).size;
    const bestUnique = new Set(best.drinks.map((d) => d.drinkDefinitionId)).size;
    return unique > bestUnique ? s : best;
  });
  const uniqueCount = new Set(mostUnique.drinks.map((d) => d.drinkDefinitionId)).size;
  prs.push(makePR('most_unique_drinks', uniqueCount, `${uniqueCount} unique`, mostUnique));

  return prs;
}

function makePR(
  category: PRCategory,
  value: number,
  formattedValue: string,
  session: typeof MOCK_SESSIONS[number],
): PersonalRecord {
  return {
    id: generateId(),
    userId: DEMO_USER.id,
    category,
    value,
    formattedValue,
    previousValue: null,
    sessionId: session.id,
    achievedAt: session.endedAt ?? session.startedAt,
    celebrated: true,
  };
}

// ── Public API ──────────────────────────────────────────────

export function isDemoSeeded(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.SEEDED) === 'true';
}

export function seedDemoData(): void {
  if (typeof window === 'undefined') return;
  if (isDemoSeeded()) return;

  // Auth state
  localStorage.setItem(
    STORAGE_KEYS.AUTH,
    zustandPersist({
      currentUser: DEMO_USER,
      isAuthenticated: true,
      allUsers: MOCK_USERS,
    }),
  );

  // Sessions state
  localStorage.setItem(
    STORAGE_KEYS.SESSIONS,
    zustandPersist({
      activeSession: null,
      sessionHistory: MOCK_SESSIONS,
    }),
  );

  // Feed state — start empty, users create their own
  localStorage.setItem(
    STORAGE_KEYS.FEED,
    zustandPersist({
      items: [],
    }),
  );

  // Groups state
  // Groups — start empty, users create their own
  localStorage.setItem(
    STORAGE_KEYS.GROUPS,
    zustandPersist({
      groups: [],
      challenges: [],
    }),
  );

  // Profile / PRs
  const prs = computeDemoPRs();
  localStorage.setItem(
    STORAGE_KEYS.PROFILE,
    zustandPersist({
      personalRecords: prs,
    }),
  );

  // Mark as seeded
  localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
}

export function clearDemoData(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEYS.AUTH);
  localStorage.removeItem(STORAGE_KEYS.SESSIONS);
  localStorage.removeItem(STORAGE_KEYS.FEED);
  localStorage.removeItem(STORAGE_KEYS.GROUPS);
  localStorage.removeItem(STORAGE_KEYS.PROFILE);
  localStorage.removeItem(STORAGE_KEYS.PARTY);
  localStorage.removeItem(STORAGE_KEYS.UI);
  localStorage.removeItem(STORAGE_KEYS.SEEDED);
}
