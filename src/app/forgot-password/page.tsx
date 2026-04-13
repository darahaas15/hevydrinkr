'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { AuthInput, ErrorMsg } from '@/components/ui/auth-input';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    setSubmitting(true);
    setError('');

    const redirectBase = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${redirectBase}/reset-password`,
    });

    setSubmitting(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center relative overflow-hidden" style={{ background: '#06060a' }}>
      {/* Ambient blurs */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(20,184,166,0.07) 0%, transparent 60%)' }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 60%)' }} />

      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 flex flex-col w-full max-w-sm px-6 pt-3 pb-6 safe-top safe-bottom flex-1"
      >
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1 text-zinc-500 text-sm mb-5 self-start active:text-zinc-300 transition-colors -ml-1"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {!sent ? (
          <>
            <h2 className="text-[26px] font-extrabold tracking-tight mb-1">Reset Password</h2>
            <p className="text-sm text-zinc-500 mb-8">Enter your email and we&apos;ll send you a reset link</p>

            <div className="space-y-3 mb-4">
              <AuthInput icon={<Mail className="w-4 h-4" />} type="email" value={email} onChange={setEmail} placeholder="Email" onSubmit={handleSubmit} />
            </div>

            {error && <ErrorMsg message={error} />}

            <div className="pt-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-[15px] rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40 text-black transition-opacity"
                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)' }}
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
              </motion.button>
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center mt-12"
          >
            <CheckCircle className="w-12 h-12 text-accent mb-4" />
            <h2 className="text-[22px] font-extrabold tracking-tight mb-2">Check your email</h2>
            <p className="text-sm text-zinc-500 leading-relaxed mb-8">
              We sent a password reset link to<br />
              <span className="text-zinc-300">{email}</span>
            </p>
            <p className="text-xs text-zinc-600 mb-8">
              Didn&apos;t get it? Check your spam folder.
            </p>
            <button
              onClick={() => router.push('/')}
              className="text-sm text-accent active:text-accent/70 transition-colors"
            >
              Back to Sign In
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
