'use client';

import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/logo';

export function SplashScreen() {
  return (
    <div
      className="h-dvh flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--background)' }}
    >
      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, rgba(20,184,166,0) 70%)',
          }}
        />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Logo size={72} />
      </motion.div>

      {/* App name */}
      <motion.h1
        className="mt-4 text-2xl font-extrabold tracking-tight gradient-text"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
      >
        Drinkr
      </motion.h1>

      {/* Loading dots */}
      <div className="mt-8 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-accent/60"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  );
}
