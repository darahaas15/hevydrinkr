'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  color?: 'purple' | 'pink' | 'cyan' | 'amber' | 'green' | 'red';
  className?: string;
  height?: 'sm' | 'md';
  showLabel?: boolean;
}

const colorStyles: Record<string, string> = {
  purple: 'bg-gradient-to-r from-purple-500 to-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.4)]',
  pink: 'bg-gradient-to-r from-pink-500 to-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.4)]',
  cyan: 'bg-gradient-to-r from-cyan-500 to-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]',
  amber: 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
  green: 'bg-gradient-to-r from-green-500 to-green-400 shadow-[0_0_8px_rgba(34,197,94,0.4)]',
  red: 'bg-gradient-to-r from-red-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
};

const heightStyles: Record<string, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
};

export default function ProgressBar({
  value,
  color = 'purple',
  className,
  height = 'md',
  showLabel = false,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-end mb-1">
          <span className="text-xs text-zinc-400">{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div
        className={cn(
          'w-full bg-white/5 rounded-full overflow-hidden',
          heightStyles[height]
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', colorStyles[color])}
        />
      </div>
    </div>
  );
}
