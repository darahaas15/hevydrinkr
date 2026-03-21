'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/use-auth-store';

type Screen = 'landing' | 'signup' | 'login';

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="h-dvh flex items-center justify-center" style={{ background: '#09090b' }}><div className="text-3xl animate-pulse">🥃</div></div>}>
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
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(inviteCode ? `/invite/${inviteCode}` : '/feed');
    }
  }, [isLoading, isAuthenticated, router, inviteCode]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="h-dvh flex items-center justify-center" style={{ background: '#09090b' }}>
        <div className="text-3xl animate-pulse">🥃</div>
      </div>
    );
  }

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !username.trim() || !displayName.trim()) {
      setError('Please fill in all fields');
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
    <div className="h-dvh flex flex-col items-center justify-between px-6 py-16 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-accent/[0.03] rounded-full blur-[150px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {screen === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 flex flex-col items-center text-center w-full max-w-sm flex-1 justify-between"
          >
            <div />

            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                className="text-7xl mb-6"
              >
                🥃
              </motion.div>
              <h1 className="text-4xl font-extrabold tracking-tight">
                hevy<span className="gradient-text">drinkr</span>
              </h1>
            </div>

            <div className="w-full space-y-2.5">
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setScreen('signup'); setError(''); }}
                className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-base flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </motion.button>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                onClick={() => { setScreen('login'); setError(''); }}
                className="w-full py-3 text-sm text-zinc-500 font-medium"
              >
                Already have an account? <span className="text-accent">Sign in</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {screen === 'signup' && (
          <motion.div
            key="signup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 flex flex-col w-full max-w-sm flex-1"
          >
            <button onClick={() => { setScreen('landing'); setError(''); }} className="flex items-center gap-1 text-zinc-500 text-sm mb-8 self-start">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <h2 className="text-2xl font-extrabold mb-1">Create Account</h2>
            <p className="text-sm text-zinc-500 mb-6">Join the party</p>

            <div className="space-y-4 flex-1">
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5 block">Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5 block">Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">@</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    className="w-full pl-9 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5 block">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}
            </div>

            <div className="py-4">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSignup}
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
              </motion.button>
            </div>
          </motion.div>
        )}

        {screen === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 flex flex-col w-full max-w-sm flex-1"
          >
            <button onClick={() => { setScreen('landing'); setError(''); }} className="flex items-center gap-1 text-zinc-500 text-sm mb-8 self-start">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <h2 className="text-2xl font-extrabold mb-1">Welcome Back</h2>
            <p className="text-sm text-zinc-500 mb-6">Sign in to your account</p>

            <div className="space-y-4 flex-1">
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5 block">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}
            </div>

            <div className="py-4 space-y-2.5">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleLogin}
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
              </motion.button>

              <button
                onClick={() => { setScreen('signup'); setError(''); }}
                className="w-full py-3 text-sm text-zinc-500"
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
