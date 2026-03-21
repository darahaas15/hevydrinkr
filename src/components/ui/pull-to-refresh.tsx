'use client';

import React, { useRef, useState, useCallback } from 'react';

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
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const isPastThreshold = pullDistance >= threshold;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      const container = containerRef.current;
      if (!container || container.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
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
        setPullDistance(0);
        return;
      }

      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 0) {
        setPullDistance(delta * PULL_RESISTANCE);
      }
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (refreshing) return;
    startYRef.current = null;

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
