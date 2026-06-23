'use client';

import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorBanner({ message = 'Something went wrong', onRetry }: ErrorBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-4 px-4 py-3 rounded-xl bg-red-500/[0.08] border border-red-500/20 flex items-center gap-3"
    >
      <AlertCircle className="w-4 h-4 text-danger-fg shrink-0" />
      <p className="text-sm text-red-300 flex-1">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-raised text-xs font-medium text-fg-strong active:bg-surface-hover-strong transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </motion.div>
  );
}
