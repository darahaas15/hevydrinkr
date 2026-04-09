'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft, Loader2, User, Mail, Lock, Calendar, AtSign } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { useAuthStore } from '@/stores/use-auth-store';
import { SplashScreen } from '@/components/ui/splash-screen';
import { migrateStorageKeys } from '@/lib/storage-migration';

type Screen = 'landing' | 'signup' | 'login';

export default function LandingPage() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <LandingContent />
    </Suspense>
  );
}

function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite');
  const authSignup = useAuthStore((s) => s.signup);
  const authLogin = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);

  const [screen, setScreen] = useState<Screen>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dob, setDob] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    migrateStorageKeys();
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(inviteCode ? `/invite/${inviteCode}` : '/feed');
    }
  }, [isLoading, isAuthenticated, router, inviteCode]);

  if (isLoading || isAuthenticated) {
    return <SplashScreen />;
  }

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !username.trim() || !displayName.trim() || !dob) {
      setError('Please fill in all fields');
      return;
    }
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      setError('You must be at least 18 years old to use Drinkr');
      return;
    }
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    setError('');
    const err = await authSignup(email.trim(), password, username.trim(), displayName.trim());
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      router.push(inviteCode ? `/invite/${inviteCode}` : '/feed');
    }
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    setError('');
    const err = await authLogin(loginEmail.trim(), loginPassword);
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      router.push(inviteCode ? `/invite/${inviteCode}` : '/feed');
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center relative overflow-hidden" style={{ background: '#06060a' }}>
      {/* Ambient blurs */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(20,184,166,0.07) 0%, transparent 60%)' }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 60%)' }} />

      <AnimatePresence mode="wait">
        {/* ────────────── LANDING ────────────── */}
        {screen === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 flex flex-col items-center w-full max-w-sm px-8 flex-1 safe-top safe-bottom"
          >
            <div className="flex-1 min-h-[18vh]" />

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mb-8"
            >
              <Logo size={56} />
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-[42px] font-extrabold tracking-tight leading-none mb-3"
            >
              <span className="gradient-text">Drinkr</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[15px] text-zinc-500 text-center leading-relaxed mb-12"
            >
              Track sessions. Compete with friends.<br />Own the night.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="w-full space-y-3"
            >
              <button
                onClick={() => { setScreen('signup'); setError(''); }}
                className="w-full py-[15px] rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 text-black active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)' }}
              >
                Get Started
                <ArrowRight className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => { setScreen('login'); setError(''); }}
                className="w-full py-[15px] rounded-2xl font-semibold text-[15px] text-zinc-400 active:bg-white/[0.03] transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Sign In
              </button>
            </motion.div>

            <div className="flex-1 min-h-[10vh]" />

            {/* Disclaimer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-[10px] text-zinc-700 text-center max-w-[280px] leading-relaxed pb-6"
            >
              For adults 18+ only. Drink responsibly. If you need help, contact SAMHSA at 1-800-662-4357.
            </motion.p>
          </motion.div>
        )}

        {/* ────────────── SIGN UP ────────────── */}
        {screen === 'signup' && (
          <motion.div
            key="signup"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 flex flex-col w-full max-w-sm px-6 pt-3 pb-6 safe-top safe-bottom overflow-y-auto flex-1"
          >
            <button onClick={() => { setScreen('landing'); setError(''); }} className="flex items-center gap-1 text-zinc-500 text-sm mb-5 self-start active:text-zinc-300 transition-colors -ml-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <h2 className="text-[26px] font-extrabold tracking-tight mb-1">Create Account</h2>
            <p className="text-sm text-zinc-500 mb-6">Join the party</p>

            <div className="space-y-3 mb-5">
              <AuthInput icon={<User className="w-4 h-4" />} value={displayName} onChange={setDisplayName} placeholder="Display name" />
              <AuthInput icon={<AtSign className="w-4 h-4" />} value={username} onChange={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="username" />
              <AuthInput icon={<Mail className="w-4 h-4" />} type="email" value={email} onChange={setEmail} placeholder="Email" />
              <AuthInput icon={<Lock className="w-4 h-4" />} type="password" value={password} onChange={setPassword} placeholder="Password (6+ chars)" onSubmit={handleSignup} />

              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-accent transition-colors">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white focus:outline-none focus:border-accent/30 transition-colors [color-scheme:dark]"
                />
              </div>
              <p className="text-[10px] text-zinc-600 pl-1 -mt-1">Must be 18 or older</p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer mb-5 px-0.5">
              <div className="relative mt-[3px] shrink-0">
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="sr-only peer" />
                <div className="w-[18px] h-[18px] rounded-[5px] border border-white/10 bg-white/[0.04] peer-checked:bg-accent peer-checked:border-accent transition-all flex items-center justify-center">
                  {agreedToTerms && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </div>
              <span className="text-xs text-zinc-500 leading-relaxed">
                I agree to the <a href="/legal/terms" target="_blank" className="text-accent">Terms</a> and <a href="/legal/privacy" target="_blank" className="text-accent">Privacy Policy</a>
              </span>
            </label>

            {error && <ErrorMsg message={error} />}

            <div className="mt-auto pt-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSignup}
                disabled={submitting}
                className="w-full py-[15px] rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40 text-black transition-opacity"
                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)' }}
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ────────────── SIGN IN ────────────── */}
        {screen === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 flex flex-col w-full max-w-sm px-6 pt-3 pb-6 safe-top safe-bottom flex-1"
          >
            <button onClick={() => { setScreen('landing'); setError(''); }} className="flex items-center gap-1 text-zinc-500 text-sm mb-5 self-start active:text-zinc-300 transition-colors -ml-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <h2 className="text-[26px] font-extrabold tracking-tight mb-1">Welcome Back</h2>
            <p className="text-sm text-zinc-500 mb-8">Sign in to your account</p>

            <div className="space-y-3 mb-4">
              <AuthInput icon={<Mail className="w-4 h-4" />} type="email" value={loginEmail} onChange={setLoginEmail} placeholder="Email" />
              <AuthInput icon={<Lock className="w-4 h-4" />} type="password" value={loginPassword} onChange={setLoginPassword} placeholder="Password" onSubmit={handleLogin} />
            </div>

            {error && <ErrorMsg message={error} />}

            <div className="pt-6 space-y-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleLogin}
                disabled={submitting}
                className="w-full py-[15px] rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40 text-black transition-opacity"
                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)' }}
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
              </motion.button>

              <button
                onClick={() => { setScreen('signup'); setError(''); }}
                className="w-full py-3 text-sm text-zinc-500 active:text-zinc-300 transition-colors"
              >
                Don&apos;t have an account? <span className="text-accent">Sign up</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthInput({ icon, type = 'text', value, onChange, placeholder, onSubmit }: {
  icon: React.ReactNode; type?: string; value: string; onChange: (v: string) => void; placeholder: string; onSubmit?: () => void;
}) {
  return (
    <div className="relative group">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-accent transition-colors">{icon}</div>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={onSubmit ? (e) => e.key === 'Enter' && onSubmit() : undefined}
        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/30 transition-colors"
      />
    </div>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400 mb-4 px-1">
      {message}
    </motion.p>
  );
}
