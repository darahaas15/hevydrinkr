'use client';

import { motion } from 'framer-motion';
import type { DrinkEntry } from '@/types';

interface DrinkGaugeProps {
  standardDrinks: number;
  drinks: DrinkEntry[];
}

function getLevel(std: number): { label: string; color: string } {
  if (std < 2) return { label: 'Getting Started', color: '#10b981' };
  if (std < 4) return { label: 'Warming Up', color: '#14b8a6' };
  if (std < 7) return { label: 'In The Zone', color: '#f59e0b' };
  if (std < 10) return { label: 'Going Hard', color: '#f97316' };
  return { label: 'Beast Mode', color: '#ef4444' };
}

const HARD = new Set(['whiskey', 'vodka', 'rum', 'gin', 'brandy', 'tequila', 'shot', 'desi']);
const BEER = new Set(['beer', 'cider', 'seltzer']);

function MiniGauge({ value, max, label, color }: {
  value: number; max: number; label: string; color: string;
}) {
  const r = 40;
  const sw = 6;
  const cx = r + sw;
  const circ = Math.PI * r;
  const progress = Math.min(value / max, 1);
  const offset = circ * (1 - progress);
  const display = value >= 1000 ? `${(value / 1000).toFixed(1)}L` : `${Math.round(value)}ml`;

  return (
    <div className="flex flex-col items-center">
      <svg width={cx * 2} height={cx + 10} viewBox={`0 0 ${cx * 2} ${cx + 10}`}>
        <path
          d={`M ${sw} ${cx} A ${r} ${r} 0 0 1 ${cx * 2 - sw} ${cx}`}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} strokeLinecap="round"
        />
        <motion.path
          d={`M ${sw} ${cx} A ${r} ${r} 0 0 1 ${cx * 2 - sw} ${cx}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <text x={cx} y={cx - 4} textAnchor="middle" className="fill-white font-mono" style={{ fontSize: '18px', fontWeight: 700 }}>
          {Math.round(value)}
        </text>
        <text x={cx} y={cx + 10} textAnchor="middle" style={{ fill: 'rgba(161,161,170,1)', fontSize: '10px' }}>
          {value >= 1000 ? 'litres' : 'ml'}
        </text>
      </svg>
      <p className="text-[10px] text-zinc-500 -mt-0.5">{label}</p>
    </div>
  );
}

export function BacGauge({ standardDrinks, drinks }: DrinkGaugeProps) {
  const { label, color } = getLevel(standardDrinks);

  const hardMl = drinks.filter(d => HARD.has(d.category)).reduce((s, d) => s + d.volumeMl, 0);
  const beerMl = drinks.filter(d => BEER.has(d.category)).reduce((s, d) => s + d.volumeMl, 0);

  const radius = 60;
  const strokeWidth = 7;
  const center = radius + strokeWidth;
  const circumference = Math.PI * radius;
  const maxStd = 15;
  const progress = Math.min(standardDrinks / maxStd, 1);
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4">
      <div className="flex items-center justify-center gap-2">
        {/* Left — Spirits ml */}
        <MiniGauge value={hardMl} max={300} label="Spirits" color="#8b5cf6" />

        {/* Center — Standard drinks */}
        <div className="flex flex-col items-center">
          <svg width={center * 2} height={center + 12} viewBox={`0 0 ${center * 2} ${center + 12}`}>
            <path
              d={`M ${strokeWidth} ${center} A ${radius} ${radius} 0 0 1 ${center * 2 - strokeWidth} ${center}`}
              fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} strokeLinecap="round"
            />
            <motion.path
              d={`M ${strokeWidth} ${center} A ${radius} ${radius} 0 0 1 ${center * 2 - strokeWidth} ${center}`}
              fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            <text x={center} y={center - 8} textAnchor="middle" className="fill-white font-mono" style={{ fontSize: '24px', fontWeight: 700 }}>
              {standardDrinks.toFixed(1)}
            </text>
            <text x={center} y={center + 7} textAnchor="middle" style={{ fill: 'rgba(161,161,170,1)', fontSize: '10px' }}>
              std drinks
            </text>
          </svg>
          <p className="text-[11px] font-semibold -mt-0.5" style={{ color }}>{label}</p>
        </div>

        {/* Right — Beer ml */}
        <MiniGauge value={beerMl} max={3000} label="Beer" color="#f59e0b" />
      </div>
    </div>
  );
}
