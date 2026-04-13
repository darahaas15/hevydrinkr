import type { AwardType } from '@/types/roast';

interface AwardMeta {
  title: string;
  emoji: string;
  lines: string[];
}

const AWARD_COPY: Record<AwardType, AwardMeta> = {
  freight_train: {
    title: 'Freight Train',
    emoji: '🚂',
    lines: [
      '{name} drank like they were trying to forget something. They succeeded.',
      '{name} put the group tab in therapy this week.',
      'Someone check on {name}. {stat} standard drinks.',
      '{name} chose violence this week. {stat} standards.',
      '{name} single-handedly kept the liquor industry alive.',
    ],
  },
  lightweight: {
    title: 'Lightweight',
    emoji: '🪶',
    lines: [
      '{name} logged {stat} all week. Are you okay bro?',
      '{name} showed up but barely. {stat} standards.',
      'The bartender forgot {name} existed. {stat} drinks total.',
      '{name} was technically present. Spiritually absent. {stat} standards.',
      '{name} drank like they had a morning meeting every day.',
    ],
  },
  one_trick_pony: {
    title: 'One Trick Pony',
    emoji: '🐴',
    lines: [
      '{drink}. {drink}. {drink}. {name}, they make other drinks.',
      '{name} and {drink}. Name a more predictable duo.',
      '{name} ordered {drink} {stat} times. We get it.',
      'If {drink} was a person, {name} would marry it.',
      '{name} has never heard of a menu apparently. {drink} on repeat.',
    ],
  },
  ghost: {
    title: 'Ghost',
    emoji: '👻',
    lines: [
      'Did {name} die? Zero drinks logged. Wellness check needed.',
      '{name} went completely dark this week. Alive?',
      '{name} was last seen... actually, were they ever here?',
      'Missing persons report filed for {name}. Zero activity.',
      '{name} ghosted the entire group. Not a single drink.',
    ],
  },
  mixologist: {
    title: 'Mixologist',
    emoji: '🍸',
    lines: [
      '{name} had {stat} different drinks. Pick a lane.',
      '{name} treated the bar menu like a bucket list. {stat} unique drinks.',
      'Commitment issues? {name} had {stat} different drinks this week.',
      '{name} couldn\'t pick a drink if their life depended on it. {stat} types.',
      '{name} is either a sommelier or just indecisive. {stat} different drinks.',
    ],
  },
  marathon_runner: {
    title: 'Marathon Runner',
    emoji: '🏃',
    lines: [
      '{name} had a session that lasted {stat}. That\'s not drinking, that\'s a lifestyle.',
      '{stat} in one session. {name} moved in.',
      '{name} sat down for a drink and left {stat} later. Legend.',
      'A {stat} session. {name} basically lives at the bar now.',
      '{name} treated one session like an endurance sport. {stat}.',
    ],
  },
  sprinter: {
    title: 'Sprinter',
    emoji: '💨',
    lines: [
      '{name} put away {stat} standards in a single session. Speedrun.',
      '{stat} standard drinks. One session. {name} was on a mission.',
      '{name} didn\'t pace themselves. {stat} standards in one sitting.',
      '{name} drank like the bar was closing in 5 minutes. {stat} standards.',
      'One session, {stat} standards. {name} chose efficiency.',
    ],
  },
  social_butterfly: {
    title: 'Social Butterfly',
    emoji: '🦋',
    lines: [
      '{name} went out {stat} times this week. Do you have a home?',
      '{stat} sessions. {name} treats every night like it\'s Friday.',
      '{name} was out {stat} times. Their couch filed a missing persons report.',
      'Literally {stat} sessions. {name} is allergic to staying in.',
      '{name}\'s liver gets no days off. {stat} sessions this week.',
    ],
  },
  solo_artist: {
    title: 'Solo Artist',
    emoji: '🎸',
    lines: [
      '{name} drank alone {stat} out of {total} sessions. We\'re not judging. Actually yeah we are.',
      '{name} doesn\'t need friends to drink. Proven {stat} times this week.',
      'Most of {name}\'s sessions were solo. Independent drinker energy.',
      '{name} flew solo {stat} times. Self-sufficient king/queen.',
      '{name}: drinks alone, logs it anyway. Respect.',
    ],
  },
  early_bird: {
    title: 'Early Bird',
    emoji: '🌅',
    lines: [
      '{name} logged a drink at {stat}. The sun was barely up.',
      '{stat}. {name} was already going. Most of us were sleeping.',
      '{name} started at {stat}. That\'s breakfast time.',
      'First drink at {stat}. {name} wakes up and chooses chaos.',
      '{name} at {stat}: "It\'s 5 o\'clock somewhere."',
    ],
  },
  night_owl: {
    title: 'Night Owl',
    emoji: '🦉',
    lines: [
      '{name} was still going at {stat}. Everyone else was asleep.',
      'Last drink at {stat}. {name} closed the bar and then some.',
      '{stat}. {name} has never heard of a bedtime.',
      '{name} logged a drink at {stat}. Tomorrow is today\'s problem.',
      'The rest of the group was in bed by midnight. {name} was at {stat}.',
    ],
  },
  broken_clock: {
    title: 'Broken Clock',
    emoji: '🕐',
    lines: [
      '{name} started drinking at {stat}. On a {day}. On a {day}, {name}.',
      '{stat} on a {day}. {name} lives by their own rules.',
      'Most people are working at {stat} on a {day}. Not {name}.',
      '{name} at {stat}, {day}. Questionable timing at best.',
      'A {day}. {stat}. {name} has no concept of appropriate hours.',
    ],
  },
  weekday_warrior: {
    title: 'Weekday Warrior',
    emoji: '💼',
    lines: [
      '{name} had more weekday sessions than weekend ones. Interesting priorities.',
      'Who needs weekends? {name} drank more Mon-Fri than Sat-Sun.',
      '{name} treats Tuesday like Saturday. {stat} weekday sessions.',
      'Most of {name}\'s drinking happened on work nights. Bold strategy.',
      '{name}: harder on weekdays than weekends. Absolute menace.',
    ],
  },
  snowball: {
    title: 'Snowball',
    emoji: '⛷️',
    lines: [
      '{name} started slow and ended the week in a sprint. Classic snowball.',
      '{name}\'s week escalated. Started light, ended heavy.',
      'Monday: 1 drink. Saturday: double digits. {name} snowballed hard.',
      '{name} ramped up all week like they were warming up for the weekend.',
      'Each day {name} drank more than the last. Momentum is a hell of a thing.',
    ],
  },
  all_or_nothing: {
    title: 'All or Nothing',
    emoji: '☄️',
    lines: [
      'One night. {stat} drinks. Then radio silence. {name} is a comet.',
      '{name} compressed an entire week into one session. {stat} drinks.',
      '{name}: one massive night, nothing else. All or nothing.',
      '{stat} drinks in one session, ghost the rest. That\'s {name}\'s strategy.',
      '{name} doesn\'t do moderation. {stat} in one night, then gone.',
    ],
  },
  clockwork: {
    title: 'Clockwork',
    emoji: '⏰',
    lines: [
      'Every session at the same time. {name} runs on a schedule.',
      'You could set a watch to {name}. Always drinking around {stat}.',
      '{name} has a standing appointment with alcohol at {stat}.',
      'Creature of habit. {name} drinks at {stat} like it\'s religion.',
      '{name} at {stat}, every time. Consistency is key.',
    ],
  },
  category_locked: {
    title: 'Category Locked',
    emoji: '🔒',
    lines: [
      '{category}. Only {category}. Nothing but {category}. We get it, {name}.',
      '{name} has never left the {category} section of the menu.',
      '{name} is {category}-pilled. Not a single deviation.',
      'If it\'s not {category}, {name} doesn\'t want it.',
      '{name} and {category}. A love story more committed than most marriages.',
    ],
  },
};

export function getAwardMeta(type: AwardType): AwardMeta {
  return AWARD_COPY[type];
}

export function pickRoastLine(
  type: AwardType,
  vars: Record<string, string>,
  seed?: string,
): string {
  const meta = AWARD_COPY[type];
  // Use a deterministic-ish pick based on a seed (weekKey + userId) so the
  // same recap always shows the same line, but different weeks/users get
  // different lines.
  let index = 0;
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    index = Math.abs(hash) % meta.lines.length;
  } else {
    index = Math.floor(Math.random() * meta.lines.length);
  }

  let line = meta.lines[index];
  for (const [key, value] of Object.entries(vars)) {
    line = line.replaceAll(`{${key}}`, value);
  }
  return line;
}
