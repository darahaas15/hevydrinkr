import type { FeedItem } from '@/types/feed';
import type { AwardType, RoastAward, RoastRecapSummary } from '@/types/roast';
import { getAwardMeta, pickRoastLine } from './roast-copy';

export interface MemberWeekData {
  userId: string;
  userName: string;
  userAvatar: string | null;
  posts: FeedItem[];
}

interface MemberStats {
  userId: string;
  userName: string;
  userAvatar: string | null;
  totalStandardDrinks: number;
  totalDrinks: number;
  totalSessions: number;
  uniqueDrinkNames: Set<string>;
  longestSessionMinutes: number;
  maxSessionStdDrinks: number;
  maxSessionDrinkCount: number;
  earliestDrinkHour: number | null; // 0-23 decimal with minutes
  latestDrinkHour: number | null;
  earliestDrinkTime: string | null; // formatted "9:47am"
  latestDrinkTime: string | null;
  weekdaySessions: number;
  weekendSessions: number;
  drinksByDay: Map<number, number>; // dayIndex -> std drinks (0=Mon, 6=Sun)
  sessionTimestamps: Date[];
  categories: Map<string, number>; // category -> count
  topDrinkName: string | null;
  topDrinkCount: number;
  // for broken_clock: the most unusual session start
  mostUnusualStart: { hour: number; dayName: string; formatted: string } | null;
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m > 0 ? `${hour}:${m.toString().padStart(2, '0')}${ampm}` : `${hour}${ampm}`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function computeMemberStats(member: MemberWeekData): MemberStats {
  const stats: MemberStats = {
    userId: member.userId,
    userName: member.userName,
    userAvatar: member.userAvatar,
    totalStandardDrinks: 0,
    totalDrinks: 0,
    totalSessions: 0,
    uniqueDrinkNames: new Set(),
    longestSessionMinutes: 0,
    maxSessionStdDrinks: 0,
    maxSessionDrinkCount: 0,
    earliestDrinkHour: null,
    latestDrinkHour: null,
    earliestDrinkTime: null,
    latestDrinkTime: null,
    weekdaySessions: 0,
    weekendSessions: 0,
    drinksByDay: new Map(),
    sessionTimestamps: [],
    categories: new Map(),
    topDrinkName: null,
    topDrinkCount: 0,
    mostUnusualStart: null,
  };

  const drinkNameCounts = new Map<string, number>();

  for (const post of member.posts) {
    const s = post.sessionSummary;
    stats.totalSessions++;
    stats.totalStandardDrinks += s.totalStandardDrinks ?? 0;
    stats.totalDrinks += s.totalDrinks ?? 0;
    stats.longestSessionMinutes = Math.max(stats.longestSessionMinutes, s.durationMinutes ?? 0);
    stats.maxSessionStdDrinks = Math.max(stats.maxSessionStdDrinks, s.totalStandardDrinks ?? 0);
    stats.maxSessionDrinkCount = Math.max(stats.maxSessionDrinkCount, s.totalDrinks ?? 0);

    const postDate = new Date(post.createdAt);
    stats.sessionTimestamps.push(postDate);
    const dayOfWeek = postDate.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      stats.weekendSessions++;
    } else {
      stats.weekdaySessions++;
    }

    // Map to Mon=0 for drinksByDay tracking
    const monBasedDay = (dayOfWeek + 6) % 7;
    stats.drinksByDay.set(monBasedDay, (stats.drinksByDay.get(monBasedDay) ?? 0) + (s.totalStandardDrinks ?? 0));

    // Time analysis
    const hourDecimal = postDate.getHours() + postDate.getMinutes() / 60;
    if (stats.earliestDrinkHour === null || hourDecimal < stats.earliestDrinkHour) {
      stats.earliestDrinkHour = hourDecimal;
      stats.earliestDrinkTime = formatTime(postDate);
    }
    if (stats.latestDrinkHour === null || hourDecimal > stats.latestDrinkHour) {
      stats.latestDrinkHour = hourDecimal;
      stats.latestDrinkTime = formatTime(postDate);
    }

    // Broken clock: weekday sessions before noon are unusual
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    if (isWeekday && hourDecimal < 14) {
      if (!stats.mostUnusualStart || hourDecimal < stats.mostUnusualStart.hour) {
        stats.mostUnusualStart = {
          hour: hourDecimal,
          dayName: DAY_NAMES[dayOfWeek],
          formatted: formatTime(postDate),
        };
      }
    }

    // Drinks breakdown
    for (const drink of s.drinks ?? []) {
      stats.uniqueDrinkNames.add(drink.name);
      const count = (drinkNameCounts.get(drink.name) ?? 0) + 1;
      drinkNameCounts.set(drink.name, count);

      if (drink.category) {
        stats.categories.set(drink.category, (stats.categories.get(drink.category) ?? 0) + 1);
      }
    }
  }

  // Find top drink
  for (const [name, count] of drinkNameCounts) {
    if (count > stats.topDrinkCount) {
      stats.topDrinkCount = count;
      stats.topDrinkName = name;
    }
  }

  return stats;
}

function makeAward(
  type: AwardType,
  stats: MemberStats,
  vars: Record<string, string>,
  weekKey: string,
  statValue: number | null,
  statLabel: string | null,
): Omit<RoastAward, 'id' | 'recapId'> {
  const meta = getAwardMeta(type);
  const seed = `${weekKey}:${stats.userId}:${type}`;
  return {
    userId: stats.userId,
    userName: stats.userName,
    userAvatar: stats.userAvatar,
    awardType: type,
    title: meta.title,
    roastLine: pickRoastLine(type, { name: stats.userName, ...vars }, seed),
    statValue,
    statLabel,
    emoji: meta.emoji,
  };
}

export function computeWeeklyAwards(
  members: MemberWeekData[],
  weekKey: string,
): { awards: Omit<RoastAward, 'id' | 'recapId'>[]; summary: RoastRecapSummary } {
  const allStats = members.map(computeMemberStats);
  const active = allStats.filter((s) => s.totalSessions > 0);
  const awards: Omit<RoastAward, 'id' | 'recapId'>[] = [];

  // ── Summary ──
  const totalGroupStdDrinks = allStats.reduce((sum, s) => sum + s.totalStandardDrinks, 0);
  const totalGroupSessions = allStats.reduce((sum, s) => sum + s.totalSessions, 0);
  const totalGroupDrinks = allStats.reduce((sum, s) => sum + s.totalDrinks, 0);

  // Most active day of week
  const dayTotals = new Map<number, number>();
  for (const s of allStats) {
    for (const [day, val] of s.drinksByDay) {
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + val);
    }
  }
  let mostActiveDay: string | null = null;
  let maxDayVal = 0;
  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  for (const [day, val] of dayTotals) {
    if (val > maxDayVal) {
      maxDayVal = val;
      mostActiveDay = dayLabels[day];
    }
  }

  const summary: RoastRecapSummary = {
    totalGroupDrinks,
    totalGroupSessions,
    totalGroupStandardDrinks: Math.round(totalGroupStdDrinks * 10) / 10,
    mostActiveDay,
    memberCount: members.length,
    participatingMemberCount: active.length,
    weekOverWeekChange: null, // computed by the store using previous week's recap
  };

  // Need at least 2 active members for comparative awards
  const hasComparison = active.length >= 2;

  // ── Ghost ── (anyone with 0 sessions)
  for (const s of allStats) {
    if (s.totalSessions === 0) {
      awards.push(makeAward('ghost', s, {}, weekKey, 0, '0 drinks'));
    }
  }

  if (!hasComparison) return { awards, summary };

  // ── Freight Train ── (most std drinks)
  const sortedByStd = [...active].sort((a, b) => b.totalStandardDrinks - a.totalStandardDrinks);
  const freightTrain = sortedByStd[0];
  if (freightTrain.totalStandardDrinks > 0) {
    const val = Math.round(freightTrain.totalStandardDrinks * 10) / 10;
    awards.push(makeAward('freight_train', freightTrain,
      { stat: `${val}` }, weekKey, val, `${val} standard drinks`));
  }

  // ── Lightweight ── (fewest std drinks, must have at least 1 session)
  const lightweight = sortedByStd[sortedByStd.length - 1];
  if (lightweight.userId !== freightTrain.userId && lightweight.totalStandardDrinks > 0) {
    const val = Math.round(lightweight.totalStandardDrinks * 10) / 10;
    awards.push(makeAward('lightweight', lightweight,
      { stat: `${val} standard drinks` }, weekKey, val, `${val} standard drinks`));
  }

  // ── Sprinter ── (highest std drinks in a single session)
  const sortedBySprint = [...active].sort((a, b) => b.maxSessionStdDrinks - a.maxSessionStdDrinks);
  const sprinter = sortedBySprint[0];
  if (sprinter.maxSessionStdDrinks >= 4 && sprinter.userId !== freightTrain.userId) {
    const val = Math.round(sprinter.maxSessionStdDrinks * 10) / 10;
    awards.push(makeAward('sprinter', sprinter,
      { stat: `${val}` }, weekKey, val, `${val} std in one session`));
  }

  // ── Marathon Runner ── (longest single session)
  const sortedByDuration = [...active].sort((a, b) => b.longestSessionMinutes - a.longestSessionMinutes);
  const marathoner = sortedByDuration[0];
  if (marathoner.longestSessionMinutes >= 60) {
    const formatted = formatDuration(marathoner.longestSessionMinutes);
    awards.push(makeAward('marathon_runner', marathoner,
      { stat: formatted }, weekKey, marathoner.longestSessionMinutes, formatted));
  }

  // ── One Trick Pony ── (fewest unique drinks, min 3 total drinks)
  const ponyEligible = active.filter((s) => s.totalDrinks >= 3);
  if (ponyEligible.length > 0) {
    const sortedByVariety = [...ponyEligible].sort((a, b) => a.uniqueDrinkNames.size - b.uniqueDrinkNames.size);
    const pony = sortedByVariety[0];
    if (pony.uniqueDrinkNames.size <= 2 && pony.topDrinkName) {
      awards.push(makeAward('one_trick_pony', pony,
        { drink: pony.topDrinkName, stat: `${pony.topDrinkCount}` },
        weekKey, pony.topDrinkCount, `${pony.topDrinkName} x${pony.topDrinkCount}`));
    }
  }

  // ── Mixologist ── (most unique drinks, min 4 unique)
  const sortedByUnique = [...active].sort((a, b) => b.uniqueDrinkNames.size - a.uniqueDrinkNames.size);
  const mixologist = sortedByUnique[0];
  if (mixologist.uniqueDrinkNames.size >= 4) {
    awards.push(makeAward('mixologist', mixologist,
      { stat: `${mixologist.uniqueDrinkNames.size}` },
      weekKey, mixologist.uniqueDrinkNames.size, `${mixologist.uniqueDrinkNames.size} unique drinks`));
  }

  // ── Social Butterfly ── (most sessions, min 3)
  const sortedBySessions = [...active].sort((a, b) => b.totalSessions - a.totalSessions);
  const butterfly = sortedBySessions[0];
  if (butterfly.totalSessions >= 3) {
    awards.push(makeAward('social_butterfly', butterfly,
      { stat: `${butterfly.totalSessions}` },
      weekKey, butterfly.totalSessions, `${butterfly.totalSessions} sessions`));
  }

  // ── Early Bird ── (earliest session, before 2pm)
  const withEarly = active.filter((s) => s.earliestDrinkHour !== null && s.earliestDrinkHour < 14);
  if (withEarly.length > 0) {
    const earliest = withEarly.sort((a, b) => a.earliestDrinkHour! - b.earliestDrinkHour!)[0];
    awards.push(makeAward('early_bird', earliest,
      { stat: earliest.earliestDrinkTime! },
      weekKey, earliest.earliestDrinkHour!, earliest.earliestDrinkTime!));
  }

  // ── Night Owl ── (latest session, after 11pm)
  const withLate = active.filter((s) => s.latestDrinkHour !== null && s.latestDrinkHour >= 23);
  if (withLate.length > 0) {
    const latest = withLate.sort((a, b) => b.latestDrinkHour! - a.latestDrinkHour!)[0];
    awards.push(makeAward('night_owl', latest,
      { stat: latest.latestDrinkTime! },
      weekKey, latest.latestDrinkHour!, latest.latestDrinkTime!));
  }

  // ── Broken Clock ── (drinking at unusual times on weekdays)
  const withUnusual = active.filter((s) => s.mostUnusualStart !== null);
  if (withUnusual.length > 0) {
    const worst = withUnusual.sort((a, b) => a.mostUnusualStart!.hour - b.mostUnusualStart!.hour)[0];
    const u = worst.mostUnusualStart!;
    awards.push(makeAward('broken_clock', worst,
      { stat: u.formatted, day: u.dayName },
      weekKey, u.hour, `${u.formatted} on a ${u.dayName}`));
  }

  // ── Weekday Warrior ── (more weekday than weekend sessions, min 3 weekday)
  const warriors = active.filter((s) => s.weekdaySessions > s.weekendSessions && s.weekdaySessions >= 3);
  if (warriors.length > 0) {
    const warrior = warriors.sort((a, b) => b.weekdaySessions - a.weekdaySessions)[0];
    awards.push(makeAward('weekday_warrior', warrior,
      { stat: `${warrior.weekdaySessions}` },
      weekKey, warrior.weekdaySessions, `${warrior.weekdaySessions} weekday sessions`));
  }

  // ── Category Locked ── (all drinks in one category, min 3 drinks)
  for (const s of active) {
    if (s.categories.size === 1 && s.totalDrinks >= 3) {
      const category = [...s.categories.keys()][0];
      // Don't double up with one_trick_pony
      if (!awards.some((a) => a.userId === s.userId && a.awardType === 'one_trick_pony')) {
        awards.push(makeAward('category_locked', s,
          { category }, weekKey, s.totalDrinks, `${s.totalDrinks} ${category}`));
      }
      break; // only one person gets this
    }
  }

  // ── Snowball ── (each day's drinking > previous day's, min 3 distinct days)
  for (const s of active) {
    const days = [...s.drinksByDay.entries()].sort((a, b) => a[0] - b[0]);
    if (days.length >= 3) {
      let isSnowball = true;
      for (let i = 1; i < days.length; i++) {
        if (days[i][1] <= days[i - 1][1]) { isSnowball = false; break; }
      }
      if (isSnowball) {
        awards.push(makeAward('snowball', s, {}, weekKey, days.length, `${days.length} escalating days`));
        break; // only one snowball per week
      }
    }
  }

  // ── All or Nothing ── (1 session but high volume, min 5 std drinks)
  for (const s of active) {
    if (s.totalSessions === 1 && s.totalStandardDrinks >= 5) {
      const val = Math.round(s.totalStandardDrinks * 10) / 10;
      awards.push(makeAward('all_or_nothing', s,
        { stat: `${val}` }, weekKey, val, `${val} drinks in one night`));
      break;
    }
  }

  // Deduplicate: a member should get at most 2 awards (to keep it punchy)
  const awardCountByUser = new Map<string, number>();
  const filtered: typeof awards = [];
  for (const award of awards) {
    const count = awardCountByUser.get(award.userId) ?? 0;
    if (count < 2) {
      filtered.push(award);
      awardCountByUser.set(award.userId, count + 1);
    }
  }

  return { awards: filtered, summary };
}
