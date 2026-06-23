import {
  TrendingUp,
  Feather,
  Repeat,
  UserX,
  Palette,
  Timer,
  Zap,
  CalendarDays,
  Headphones,
  Sunrise,
  Moon,
  AlarmClock,
  Briefcase,
  ArrowUpRight,
  Target,
  Clock,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import type { AwardType } from '@/types/roast';

interface AwardVisual {
  icon: LucideIcon;
  color: string;     // text color class
  bg: string;        // bg color class for the icon badge
}

export const AWARD_ICONS: Record<AwardType, AwardVisual> = {
  freight_train:    { icon: TrendingUp,   color: 'text-danger-fg',     bg: 'bg-red-500/15' },
  lightweight:      { icon: Feather,      color: 'text-sky-fg',     bg: 'bg-sky-500/15' },
  one_trick_pony:   { icon: Repeat,       color: 'text-warning-fg',   bg: 'bg-amber-500/15' },
  ghost:            { icon: UserX,        color: 'text-muted-foreground',    bg: 'bg-zinc-500/15' },
  mixologist:       { icon: Palette,      color: 'text-violet-fg',  bg: 'bg-purple-500/15' },
  marathon_runner:  { icon: Timer,        color: 'text-success-fg', bg: 'bg-emerald-500/15' },
  sprinter:         { icon: Zap,          color: 'text-yellow-fg',  bg: 'bg-yellow-500/15' },
  social_butterfly: { icon: CalendarDays, color: 'text-pink-fg',    bg: 'bg-pink-500/15' },
  solo_artist:      { icon: Headphones,   color: 'text-muted-foreground',    bg: 'bg-zinc-500/15' },
  early_bird:       { icon: Sunrise,      color: 'text-warning-fg',   bg: 'bg-amber-500/15' },
  night_owl:        { icon: Moon,         color: 'text-indigo-fg',  bg: 'bg-indigo-500/15' },
  broken_clock:     { icon: AlarmClock,   color: 'text-danger-fg',     bg: 'bg-red-500/15' },
  weekday_warrior:  { icon: Briefcase,    color: 'text-orange-fg',  bg: 'bg-orange-500/15' },
  snowball:         { icon: ArrowUpRight, color: 'text-info-fg',    bg: 'bg-cyan-500/15' },
  all_or_nothing:   { icon: Target,       color: 'text-danger-fg',     bg: 'bg-red-500/15' },
  clockwork:        { icon: Clock,        color: 'text-fg-strong',    bg: 'bg-zinc-500/15' },
  category_locked:  { icon: Lock,         color: 'text-warning-fg',   bg: 'bg-amber-500/15' },
};
