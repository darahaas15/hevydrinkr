'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useUIStore } from '@/stores/use-ui-store';
import { cn } from '@/lib/utils';

const styles: Record<string, { border: string; icon: typeof AlertCircle; iconColor: string }> = {
  success: { border: 'border-l-green-500', icon: CheckCircle, iconColor: 'text-green-500' },
  error: { border: 'border-l-red-500', icon: AlertCircle, iconColor: 'text-red-500' },
  info: { border: 'border-l-accent', icon: Info, iconColor: 'text-accent' },
};

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[51] safe-bottom pointer-events-none" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="max-w-lg mx-auto px-3 flex flex-col gap-1.5">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const s = styles[toast.type] || styles.info;
            const Icon = s.icon;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={cn(
                  'rounded-xl px-3.5 py-3 border-l-4 pointer-events-auto flex items-center gap-2.5',
                  s.border
                )}
                style={{ background: 'rgba(18,18,22,0.78)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid rgba(255,255,255,0.1)', borderLeftWidth: 4 }}
              >
                <Icon className={cn('w-4 h-4 shrink-0', s.iconColor)} />
                <p className="text-[13px] text-white flex-1">{toast.message}</p>
                <button
                  onClick={() => removeToast(toast.id)}
                  aria-label="Dismiss"
                  className="text-zinc-600 hover:text-white active:text-white transition-colors shrink-0 p-3 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
