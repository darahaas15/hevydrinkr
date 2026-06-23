'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Lock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { AuthInput, ErrorMsg } from '@/components/ui/auth-input';
type PageState = 'loading' | 'ready' | 'success' | 'expired';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setState('ready');
      }
    });

    // If the Supabase client already processed the hash before we subscribed,
    // check if there's an active session with a recovery type
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setState('ready');
      }
    });

    // If nothing fires after 5s, the link is likely expired
    const timeout = setTimeout(() => {
      setState((s) => (s === 'loading' ? 'expired' : s));
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    setError('');

    const { error: err } = await supabase.auth.updateUser({ password });

    setSubmitting(false);
    if (err) {
      setError(err.message);
    } else {
      setState('success');
      // Clean hash fragment from URL
      window.history.replaceState(null, '', window.location.pathname);
      // Sign out the temporary recovery session — user will log in from the PWA
      await supabase.auth.signOut();
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center relative overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Ambient blurs */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(20,184,166,0.07) 0%, transparent 60%)' }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 60%)' }} />

      <div className="relative z-10 flex flex-col w-full max-w-sm px-6 pt-3 pb-6 safe-top safe-bottom flex-1">
        {/* Loading */}
        {state === 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center flex-1 gap-3"
          >
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-sm text-fg-secondary">Verifying reset link...</p>
          </motion.div>
        )}

        {/* Ready — password form */}
        {state === 'ready' && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 pt-16"
          >
            <h2 className="text-[26px] font-extrabold tracking-tight mb-1">Set New Password</h2>
            <p className="text-sm text-fg-secondary mb-8">Choose a new password for your account</p>

            <div className="space-y-3 mb-4">
              <AuthInput icon={<Lock className="w-4 h-4" />} type="password" value={password} onChange={setPassword} placeholder="New password (6+ chars)" />
              <AuthInput icon={<Lock className="w-4 h-4" />} type="password" value={confirm} onChange={setConfirm} placeholder="Confirm password" onSubmit={handleSubmit} />
            </div>

            {error && <ErrorMsg message={error} />}

            <div className="pt-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-[15px] rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40 text-accent-foreground transition-opacity"
                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)' }}
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Success */}
        {state === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center flex-1 text-center"
          >
            <CheckCircle className="w-12 h-12 text-accent mb-4" />
            <h2 className="text-[22px] font-extrabold tracking-tight mb-2">Password Updated</h2>
            <p className="text-sm text-fg-secondary leading-relaxed">
              Open the Drinkr app and sign in<br />with your new password.
            </p>
          </motion.div>
        )}

        {/* Expired / invalid */}
        {state === 'expired' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center flex-1 text-center"
          >
            <XCircle className="w-12 h-12 text-danger-fg mb-4" />
            <h2 className="text-[22px] font-extrabold tracking-tight mb-2">Link Expired</h2>
            <p className="text-sm text-fg-secondary leading-relaxed mb-8">
              This reset link has expired or is invalid.<br />Please request a new one.
            </p>
            <button
              onClick={() => router.push('/forgot-password')}
              className="text-sm text-accent active:text-accent/70 transition-colors"
            >
              Request New Link
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
