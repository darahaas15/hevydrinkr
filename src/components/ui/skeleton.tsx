import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circle' | 'card';
}

const variantStyles: Record<string, string> = {
  text: 'h-4 w-full rounded bg-white/5 animate-pulse',
  circle: 'rounded-full bg-white/5 animate-pulse',
  card: 'h-40 w-full rounded-2xl bg-white/5 animate-pulse',
};

export default function Skeleton({
  className,
  variant = 'text',
}: SkeletonProps) {
  return <div className={cn(variantStyles[variant], className)} />;
}
