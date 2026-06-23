'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useModerationStore, REPORT_REASONS, type ReportReason } from '@/stores/use-moderation-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import { hapticLight, hapticMedium } from '@/lib/haptics';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  targetLabel?: string;
}

export function ReportModal({ open, onClose, targetType, targetId, targetLabel }: ReportModalProps) {
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const reportContent = useModerationStore((s) => s.reportContent);
  const currentUser = useAuthStore((s) => s.currentUser);
  const addToast = useUIStore((s) => s.addToast);

  const handleSubmit = async () => {
    if (!selected || !currentUser) return;
    setSubmitting(true);
    hapticMedium();
    const ok = await reportContent({
      reporterId: currentUser.id,
      targetType,
      targetId,
      reason: selected,
      details,
    });
    setSubmitting(false);
    if (ok) {
      setSubmitted(true);
    } else {
      addToast('Failed to submit report', 'error');
    }
  };

  const handleClose = () => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      setSelected(null);
      setDetails('');
      setSubmitted(false);
    }, 200);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/50" />
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-3xl overflow-hidden"
            style={{ background: 'var(--popover-strong-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {submitted ? (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-bold mb-1">Report Submitted</h3>
                <p className="text-sm text-fg-secondary leading-relaxed mb-6">Thank you. We&apos;ll review this and take action if it violates our guidelines.</p>
                <button onClick={handleClose} className="px-8 py-3 rounded-2xl bg-accent text-accent-foreground text-sm font-bold active:scale-[0.98] transition-transform">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 flex items-center justify-between border-b border-card-border">
                  <h3 className="text-base font-bold">Report</h3>
                  <button onClick={handleClose} className="p-2 -mr-2 rounded-lg active:bg-surface-strong">
                    <X className="w-5 h-5 text-fg-secondary" />
                  </button>
                </div>

                <div className="px-5 pt-4 pb-3">
                  <p className="text-[13px] text-muted-foreground mb-3">Why are you reporting this?</p>
                  <div className="space-y-2">
                    {REPORT_REASONS.map((reason) => (
                      <button
                        key={reason.value}
                        onClick={() => { hapticLight(); setSelected(reason.value); }}
                        className={`w-full px-4 py-3 rounded-xl text-left text-[13px] font-medium transition-all ${
                          selected === reason.value
                            ? 'bg-red-500/10 border border-red-500/30 text-danger-fg'
                            : 'bg-card border border-card-border text-muted-foreground active:bg-surface-subtle'
                        }`}
                      >
                        {reason.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selected === 'other' && (
                  <div className="px-5 pb-3">
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Please describe the issue..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-card border border-card-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-red-500/30 resize-none"
                    />
                  </div>
                )}

                <div className="px-5 pb-5 pt-1">
                  <button
                    onClick={handleSubmit}
                    disabled={!selected || submitting}
                    className="w-full py-3.5 rounded-2xl bg-red-500 text-white text-sm font-bold disabled:opacity-30 active:scale-[0.98] transition-all"
                  >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
