'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useUIStore } from '@/stores/use-ui-store';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';

// Surface/border/text are driven by CSS vars (see globals.css › Toast) so the
// toast stays legible per theme: translucent tints + bright text in dark, light
// pastel surfaces + darker text in light.
const styles: Record<string, { bg: string; border: string; icon: typeof AlertCircle; iconColor: string }> = {
  success: {
    bg: 'var(--toast-success-bg)',
    border: '1px solid var(--toast-success-border)',
    icon: CheckCircle,
    iconColor: 'text-[color:var(--toast-success-text)]',
  },
  error: {
    bg: 'var(--toast-error-bg)',
    border: '1px solid var(--toast-error-border)',
    icon: AlertCircle,
    iconColor: 'text-[color:var(--toast-error-text)]',
  },
  info: {
    bg: 'var(--toast-info-bg)',
    border: '1px solid var(--toast-info-border)',
    icon: Info,
    iconColor: 'text-[color:var(--toast-info-text)]',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[80] pointer-events-none"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <div className="max-w-lg mx-auto px-3 flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const s = styles[toast.type] || styles.info;
            const Icon = s.icon;
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -60 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                drag="y"
                dragConstraints={{ bottom: 0 }}
                dragElastic={0.3}
                onDragEnd={(_: unknown, info: PanInfo) => {
                  if (info.offset.y < -50 || info.velocity.y < -300) {
                    hapticLight();
                    removeToast(toast.id);
                  }
                }}
                className="rounded-xl px-3.5 py-2.5 pointer-events-auto flex items-center gap-2.5 cursor-grab active:cursor-grabbing"
                style={{
                  background: s.bg,
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  border: s.border,
                }}
              >
                <Icon className={cn('w-4 h-4 shrink-0', s.iconColor)} />
                <p className="text-[13px] text-[color:var(--toast-fg)] flex-1">{toast.message}</p>
                {toast.action && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticLight();
                      toast.action!.onPress();
                      removeToast(toast.id);
                    }}
                    className={cn('text-[13px] font-semibold px-2 py-1 rounded-md', s.iconColor)}
                  >
                    {toast.action.label}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticLight();
                    removeToast(toast.id);
                  }}
                  aria-label="Dismiss"
                  className="p-1 -mr-1 text-fg-secondary active:text-fg-strong"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
