'use client';

import { useState, useEffect } from 'react';
import type { DrinkEntry } from '@/types';
import type { Gender } from '@/types/user';
import { calculateBAC, getBacLevel, getBacColor, getBacLabel, estimateTimeTillSober } from '@/lib/algorithms/bac';

export function useBAC(
  drinks: DrinkEntry[],
  weightKg: number,
  gender: Gender
) {
  const [bac, setBac] = useState(0);

  useEffect(() => {
    if (drinks.length === 0) {
      setBac(0);
      return;
    }

    const update = () => {
      const currentBac = calculateBAC(drinks, weightKg, gender);
      setBac(currentBac);
    };

    update();
    const interval = setInterval(update, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [drinks, weightKg, gender]);

  return {
    bac,
    level: getBacLevel(bac),
    color: getBacColor(bac),
    label: getBacLabel(bac),
    timeTillSober: estimateTimeTillSober(bac),
    formatted: bac.toFixed(3),
  };
}
