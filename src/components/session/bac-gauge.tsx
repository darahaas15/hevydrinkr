'use client';

import { motion } from 'framer-motion';
import type { DrinkEntry } from '@/types';
import {
  BEER_GAUGE_MAX_ML,
  GAUGE_MAX_STANDARD_DRINKS,
  SPIRITS_GAUGE_MAX_ML,
  beerVolumeMl,
  drinkLevel,
  gaugeProgress,
  gaugeVolumeLabel,
  spiritsVolumeMl,
} from '@/lib/drink-gauge';

interface DrinkGaugeProps {
  standardDrinks: number;
  drinks: DrinkEntry[];
}

function MiniGauge({ value, max, label, color }: {
  value: number; max: number; label: string; color: string;
}) {
  const r = 40;
  const sw = 6;
  const cx = r + sw;
  const circ = Math.PI * r;
  const progress = gaugeProgress(value, max);
  const offset = circ * (1 - progress);
  const volume = gaugeVolumeLabel(value);

  return (
    <div className="flex flex-col items-center">
      <svg width={cx * 2} height={cx + 10} viewBox={`0 0 ${cx * 2} ${cx + 10}`}>
        <path
          d={`M ${sw} ${cx} A ${r} ${r} 0 0 1 ${cx * 2 - sw} ${cx}`}
          fill="none" strokeWidth={sw} strokeLinecap="round" style={{ stroke: 'var(--border-faint)' }}
        />
        <motion.path
          d={`M ${sw} ${cx} A ${r} ${r} 0 0 1 ${cx * 2 - sw} ${cx}`}
          fill="none" strokeWidth={sw} strokeLinecap="round" style={{ stroke: color }}
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <text x={cx} y={cx - 4} textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: '18px', fontWeight: 700 }}>
          {volume.value}
        </text>
        <text x={cx} y={cx + 10} textAnchor="middle" style={{ fill: 'var(--muted-foreground)', fontSize: '10px' }}>
          {volume.unit}
        </text>
      </svg>
      <p className="text-[10px] text-fg-secondary -mt-0.5">{label}</p>
    </div>
  );
}

export function BacGauge({ standardDrinks, drinks }: DrinkGaugeProps) {
  // Colors are theme-aware CSS vars (see globals.css › --gauge-*): vivid on
  // dark, AA-safe deep shades on light so the arc + status label read on a
  // white card.
  const { label, level } = drinkLevel(standardDrinks);
  const color = `var(--gauge-${level})`;

  const hardMl = spiritsVolumeMl(drinks);
  const beerMl = beerVolumeMl(drinks);

  const radius = 60;
  const strokeWidth = 7;
  const center = radius + strokeWidth;
  const circumference = Math.PI * radius;
  const progress = gaugeProgress(standardDrinks, GAUGE_MAX_STANDARD_DRINKS);
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="rounded-2xl bg-card border border-hairline p-4">
      <div className="flex items-center justify-center gap-2">
        {/* Left — Spirits ml */}
        <MiniGauge value={hardMl} max={SPIRITS_GAUGE_MAX_ML} label="Spirits" color="var(--violet)" />

        {/* Center — Standard drinks */}
        <div className="flex flex-col items-center">
          <svg width={center * 2} height={center + 12} viewBox={`0 0 ${center * 2} ${center + 12}`}>
            <path
              d={`M ${strokeWidth} ${center} A ${radius} ${radius} 0 0 1 ${center * 2 - strokeWidth} ${center}`}
              fill="none" strokeWidth={strokeWidth} strokeLinecap="round" style={{ stroke: 'var(--border-faint)' }}
            />
            <motion.path
              d={`M ${strokeWidth} ${center} A ${radius} ${radius} 0 0 1 ${center * 2 - strokeWidth} ${center}`}
              fill="none" strokeWidth={strokeWidth} strokeLinecap="round" style={{ stroke: color }}
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            <text x={center} y={center - 8} textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: '24px', fontWeight: 700 }}>
              {standardDrinks.toFixed(1)}
            </text>
            <text x={center} y={center + 7} textAnchor="middle" style={{ fill: 'var(--muted-foreground)', fontSize: '10px' }}>
              std drinks
            </text>
          </svg>
          <p className="text-[11px] font-semibold -mt-0.5" style={{ color }}>{label}</p>
        </div>

        {/* Right — Beer ml */}
        <MiniGauge value={beerMl} max={BEER_GAUGE_MAX_ML} label="Beer" color="var(--gauge-3)" />
      </div>
    </div>
  );
}
