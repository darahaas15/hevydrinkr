import type { DrinkSession } from '@/types/session';
import type { PersonalRecord, PRCategory } from '@/types/pr';
import { generateId } from '@/lib/utils';

function formatPrValue(category: PRCategory, value: number): string {
  switch (category) {
    case 'most_drinks_session':
      return `${value} drinks`;
    case 'most_standard_drinks':
      return `${value.toFixed(1)} std drinks`;
    case 'longest_session':
      return `${Math.floor(value / 60)}h ${value % 60}m`;
    case 'most_unique_drinks':
      return `${value} types`;
    case 'most_rounds_bought':
      return `${value} rounds`;
    case 'fastest_drink':
      return `${value}m between drinks`;
    case 'longest_streak':
      return `${value} weeks`;
    case 'most_sessions_week':
      return `${value} sessions`;
    default:
      return `${value}`;
  }
}

function computeSessionMetric(session: DrinkSession, category: PRCategory): number | null {
  switch (category) {
    case 'most_drinks_session':
      return session.drinks.length;
    case 'most_standard_drinks':
      return session.totalStandardDrinks;
    case 'longest_session':
      return session.durationMinutes;
    case 'most_unique_drinks': {
      const unique = new Set(session.drinks.map(d => d.drinkDefinitionId));
      return unique.size;
    }
    case 'most_rounds_bought': {
      return session.rounds.filter(r => r.boughtByUserId === session.userId).length;
    }
    case 'fastest_drink': {
      if (session.drinks.length < 2) return null;
      const sorted = [...session.drinks].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      let minGap = Infinity;
      for (let i = 1; i < sorted.length; i++) {
        const gap = (new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime()) / 60000;
        if (gap < minGap) minGap = gap;
      }
      return minGap === Infinity ? null : Math.round(minGap);
    }
    default:
      return null;
  }
}

export function detectPRs(
  completedSession: DrinkSession,
  existingPRs: PersonalRecord[]
): PersonalRecord[] {
  const newPRs: PersonalRecord[] = [];
  const sessionCategories: PRCategory[] = [
    'most_drinks_session',
    'most_standard_drinks',
    'longest_session',
    'most_unique_drinks',
    'most_rounds_bought',
    'fastest_drink',
  ];

  for (const category of sessionCategories) {
    const value = computeSessionMetric(completedSession, category);
    if (value === null || value <= 0) continue;

    // For fastest_drink, lower is better
    const isBetter = category === 'fastest_drink'
      ? (newVal: number, oldVal: number) => newVal < oldVal
      : (newVal: number, oldVal: number) => newVal > oldVal;

    const existing = existingPRs.find(pr => pr.category === category && pr.userId === completedSession.userId);

    if (!existing || isBetter(value, existing.value)) {
      newPRs.push({
        id: generateId(),
        userId: completedSession.userId,
        category,
        value,
        formattedValue: formatPrValue(category, value),
        previousValue: existing?.value ?? null,
        sessionId: completedSession.id,
        achievedAt: new Date().toISOString(),
        celebrated: false,
      });
    }
  }

  return newPRs;
}
