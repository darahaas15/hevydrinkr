'use client';

import React, { useRef, useState, useCallback } from 'react';
import { hapticMedium } from '@/lib/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
}

const PULL_RESISTANCE = 0.4;

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 60,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const directionLocked = useRef<'vertical' | 'horizontal' | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const isPastThreshold = pullDistance >= threshold;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      const container = containerRef.current;
      if (!container || container.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      directionLocked.current = null;
    },
    [refreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing || startYRef.current === null) return;
      const container = containerRef.current;
      if (!container) return;

      // If the container has scrolled down, cancel the pull gesture
      if (container.scrollTop > 0) {
        startYRef.current = null;
        startXRef.current = null;
        directionLocked.current = null;
        setPullDistance(0);
        return;
      }

      // Lock scroll direction after enough movement to distinguish intent
      if (!directionLocked.current && startXRef.current !== null) {
        const dx = Math.abs(e.touches[0].clientX - startXRef.current);
        const dy = Math.abs(e.touches[0].clientY - startYRef.current);
        if (dx > 8 || dy > 8) {
          directionLocked.current = dx > dy ? 'horizontal' : 'vertical';
        }
      }

      // Don't engage pull-to-refresh on horizontal gestures (e.g. carousels)
      if (directionLocked.current === 'horizontal') return;

      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 0) {
        const newDist = delta * PULL_RESISTANCE;
        const wasBelowThreshold = pullDistance < threshold;
        setPullDistance(newDist);
        if (wasBelowThreshold && newDist >= threshold) {
          hapticMedium();
        }
      }
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (refreshing) return;
    startYRef.current = null;
    startXRef.current = null;
    directionLocked.current = null;

    if (isPastThreshold) {
      setRefreshing(true);
      setPullDistance(threshold);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [refreshing, isPastThreshold, threshold, onRefresh]);

  const spinnerOpacity = Math.min(pullDistance / threshold, 1);
  const spinnerScale = 0.5 + Math.min(pullDistance / threshold, 1) * 0.5;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-full"
    >
      {/* Spinner indicator */}
      <div
        className="flex items-center justify-center pointer-events-none"
        style={{
          height: pullDistance > 0 || refreshing ? `${pullDistance}px` : 0,
          overflow: 'hidden',
          transition: refreshing || pullDistance === 0 ? 'height 0.25s ease-out' : 'none',
        }}
      >
        <div
          style={{
            opacity: spinnerOpacity,
            transform: `scale(${spinnerScale})${refreshing ? '' : ` rotate(${pullDistance * 3}deg)`}`,
            transition: refreshing ? 'none' : 'transform 0.05s linear',
          }}
        >
          <svg
            className={refreshing ? 'animate-spin' : ''}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: isPastThreshold || refreshing ? 'var(--accent)' : '#71717a' }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(0)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
