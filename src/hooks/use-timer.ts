'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer(startTime: string | null) {
  const [elapsedSinceStart, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startTime) return;

    const start = new Date(startTime).getTime();

    const update = () => {
      const now = Date.now();
      // A session started on another device can carry a start time slightly
      // ahead of this device's clock; count from zero rather than go negative.
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
    };

    update();
    intervalRef.current = setInterval(update, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startTime]);

  // With no session the timer reads zero, whatever the last session left behind.
  const elapsed = startTime ? elapsedSinceStart : 0;

  const formatTime = useCallback(() => {
    const hrs = Math.floor(elapsed / 3600);
    const mins = Math.floor((elapsed % 3600) / 60);
    const secs = elapsed % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }, [elapsed]);

  return { elapsed, formatted: formatTime(), minutes: elapsed / 60 };
}
