'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/use-ui-store';
import { PR_ICONS, PR_LABELS } from '@/types/pr';
import { ConfettiBurst } from './confetti-burst';

export function CelebrationModal() {
  const { showCelebration, celebrationPR, dismissCelebration } = useUIStore();

  useEffect(() => {
    if (showCelebration) {
      const timer = setTimeout(dismissCelebration, 4000);
      return () => clearTimeout(timer);
    }
  }, [showCelebration, dismissCelebration]);

  return (
    <AnimatePresence>
      {showCelebration && celebrationPR && (
        <>
          <ConfettiBurst isActive onComplete={() => {}} />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center"
            onClick={dismissCelebration}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 250 }}
              className="flex flex-col items-center text-center px-8 max-w-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.1, damping: 12 }}
                className="text-6xl mb-5"
              >
                {(() => { const Icon = PR_ICONS[celebrationPR.category]; return <Icon className="w-16 h-16 text-accent" />; })()}
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-xs font-bold uppercase tracking-widest text-accent mb-2"
              >
                New Personal Record
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-lg font-bold text-zinc-300 mb-4"
              >
                {PR_LABELS[celebrationPR.category]}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="flex items-center gap-3 mb-6"
              >
                {celebrationPR.previousValue !== null && (
                  <>
                    <span className="text-xl text-zinc-600 line-through">{celebrationPR.previousValue}</span>
                    <span className="text-zinc-700">&rarr;</span>
                  </>
                )}
                <span className="text-2xl font-bold text-white">{celebrationPR.formattedValue}</span>
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                whileTap={{ scale: 0.95 }}
                onClick={dismissCelebration}
                className="px-8 py-3 rounded-2xl bg-accent text-black font-bold"
              >
                Nice!
              </motion.button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
