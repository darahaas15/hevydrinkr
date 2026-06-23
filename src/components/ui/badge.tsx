import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'purple' | 'pink' | 'cyan';
  className?: string;
  size?: 'sm' | 'md';
}

// Driven by per-variant CSS vars (see globals.css › Badge) so tint + text adapt
// per theme: bright `-400` text on a tint in dark, darker `-700` text on a
// lighter tint in light (the bare `-400`-on-tint recipe is unreadable on white).
const variantStyles: Record<string, string> = {
  default: 'bg-[var(--badge-default-bg)] text-[color:var(--badge-default-text)]',
  success: 'bg-[var(--badge-success-bg)] text-[color:var(--badge-success-text)]',
  warning: 'bg-[var(--badge-warning-bg)] text-[color:var(--badge-warning-text)]',
  danger: 'bg-[var(--badge-danger-bg)] text-[color:var(--badge-danger-text)]',
  purple: 'bg-[var(--badge-purple-bg)] text-[color:var(--badge-purple-text)]',
  pink: 'bg-[var(--badge-pink-bg)] text-[color:var(--badge-pink-text)]',
  cyan: 'bg-[var(--badge-cyan-bg)] text-[color:var(--badge-cyan-text)]',
};

const sizeStyles: Record<string, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

export default function Badge({
  children,
  variant = 'default',
  className,
  size = 'sm',
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
