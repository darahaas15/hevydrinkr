import type { DrinkSession } from '@/types/session';

function getWeekNumber(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${weekNum}`;
}

export function calculateWeeklyStreak(sessions: DrinkSession[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (sessions.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const completedSessions = sessions.filter(s => s.status === 'completed');
  if (completedSessions.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const weeks = new Set(
    completedSessions.map(s => getWeekNumber(new Date(s.startedAt)))
  );

  const sortedWeeks = [...weeks].sort();
  if (sortedWeeks.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const currentWeek = getWeekNumber(new Date());
  const lastWeek = getWeekNumber(new Date(Date.now() - 7 * 86400000));

  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < sortedWeeks.length; i++) {
    const prevDate = parseWeek(sortedWeeks[i - 1]);
    const currDate = parseWeek(sortedWeeks[i]);
    const diffDays = (currDate.getTime() - prevDate.getTime()) / 86400000;

    if (diffDays >= 6 && diffDays <= 8) {
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 1;
    }
  }

  let currentStreak = 0;
  const lastSessionWeek = sortedWeeks[sortedWeeks.length - 1];
  if (lastSessionWeek === currentWeek || lastSessionWeek === lastWeek) {
    currentStreak = 1;
    for (let i = sortedWeeks.length - 2; i >= 0; i--) {
      const prevDate = parseWeek(sortedWeeks[i]);
      const currDate = parseWeek(sortedWeeks[i + 1]);
      const diffDays = (currDate.getTime() - prevDate.getTime()) / 86400000;
      if (diffDays >= 6 && diffDays <= 8) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak };
}

function parseWeek(weekStr: string): Date {
  const [year, weekPart] = weekStr.split('-W');
  const jan4 = new Date(parseInt(year), 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
  const targetDate = new Date(startOfWeek1);
  targetDate.setDate(startOfWeek1.getDate() + (parseInt(weekPart) - 1) * 7);
  return targetDate;
}

export function calculateDailyStreak(sessions: DrinkSession[]): {
  currentStreak: number;
  longestStreak: number;
} {
  const completedSessions = sessions.filter(s => s.status === 'completed');
  if (completedSessions.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const days = new Set(
    completedSessions.map(s => {
      const d = new Date(s.startedAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const sortedDays = [...days].sort();
  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = parseDayKey(sortedDays[i - 1]);
    const curr = parseDayKey(sortedDays[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;

    if (diff === 1) {
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 1;
    }
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const yesterday = new Date(Date.now() - 86400000);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
  const lastDay = sortedDays[sortedDays.length - 1];

  let currentStreak = 0;
  if (lastDay === todayKey || lastDay === yesterdayKey) {
    currentStreak = 1;
    for (let i = sortedDays.length - 2; i >= 0; i--) {
      const prev = parseDayKey(sortedDays[i]);
      const curr = parseDayKey(sortedDays[i + 1]);
      if ((curr.getTime() - prev.getTime()) / 86400000 === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak };
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m, d);
}
