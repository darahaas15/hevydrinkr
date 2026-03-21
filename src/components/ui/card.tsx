'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  glowColor?: 'purple' | 'pink' | 'cyan' | 'amber';
  onClick?: () => void;
  padding?: 'sm' | 'md' | 'lg';
}

const glowStyles: Record<string, string> = {
  purple: '',
  pink: '',
  cyan: '',
  amber: '',
};

const paddingStyles: Record<string, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export default function Card({
  children,
  className,
  glow = false,
  glowColor = 'purple',
  onClick,
  padding = 'md',
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white/[0.03] border border-white/[0.05] rounded-2xl',
        paddingStyles[padding],
        glow && glowStyles[glowColor],
        onClick && 'cursor-pointer hover:bg-white/[0.07] transition-colors',
        className
      )}
    >
      {children}
    </div>
  );
}
