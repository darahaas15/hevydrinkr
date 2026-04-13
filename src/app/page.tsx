'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft, Loader2, User, Mail, Lock, Calendar, AtSign, Share, Plus, MoreVertical, Download, Ruler, Weight } from 'lucide-react';
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
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [weightKg, setWeightKg] = useState('70');
  const [heightCm, setHeightCm] = useState('170');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // PWA install gate
  const [isStandalone, setIsStandalone] = useState(true); // default true to avoid flash
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstallNative, setCanInstallNative] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstallNative(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      const result = await deferredPromptRef.current.userChoice;
      if (result.outcome === 'accepted') {
        setIsStandalone(true);
      }
      deferredPromptRef.current = null;
      setCanInstallNative(false);
    }
  };

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

  // Show install gate when not running as installed PWA
  if (!isStandalone) {
    return <InstallGate canInstallNative={canInstallNative} onInstall={handleInstallClick} />;
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
    const wt = parseFloat(weightKg);
    const ht = parseFloat(heightCm);
    if (isNaN(wt) || wt < 30 || wt > 300) {
      setError('Please enter a valid weight (30-300 kg)');
      return;
    }
    if (isNaN(ht) || ht < 100 || ht > 250) {
      setError('Please enter a valid height (100-250 cm)');
      return;
    }
    setSubmitting(true);
    setError('');
    const err = await authSignup(email.trim(), password, username.trim(), displayName.trim(), gender, wt, ht);
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

              <AuthInput icon={<Calendar className="w-4 h-4" />} type="date" value={dob} onChange={setDob} placeholder="Date of birth" max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().split('T')[0]; })()} />
              <p className="text-[10px] text-zinc-600 pl-1 -mt-1">Date of birth (must be 18+)</p>

              {/* Gender */}
              <div>
                <p className="text-[10px] text-zinc-500 pl-1 mb-1.5">Gender (for BAC estimation)</p>
                <div className="flex gap-2">
                  {(['male', 'female', 'other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        gender === g
                          ? 'bg-accent/10 ring-1 ring-accent/30 text-accent'
                          : 'bg-white/[0.03] border border-white/[0.06] text-zinc-500'
                      }`}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Height & Weight */}
              <div className="flex gap-3">
                <div className="flex-1 relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-accent transition-colors">
                    <Ruler className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="Height (cm)"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-accent/30 transition-colors"
                  />
                </div>
                <div className="flex-1 relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-accent transition-colors">
                    <Weight className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="Weight (kg)"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-accent/30 transition-colors"
                  />
                </div>
              </div>
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

function AuthInput({ icon, type = 'text', value, onChange, placeholder, onSubmit, max }: {
  icon: React.ReactNode; type?: string; value: string; onChange: (v: string) => void; placeholder: string; onSubmit?: () => void; max?: string;
}) {
  return (
    <div className="relative group">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-accent transition-colors">{icon}</div>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} max={max}
        onKeyDown={onSubmit ? (e) => e.key === 'Enter' && onSubmit() : undefined}
        className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/30 transition-colors${type === 'date' ? ' [color-scheme:dark] appearance-none' : ''}`}
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

// ─── PWA Install Gate ───────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function InstallGate({ canInstallNative, onInstall }: { canInstallNative: boolean; onInstall: () => void }) {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  return (
    <div className="min-h-dvh flex flex-col items-center relative overflow-hidden" style={{ background: '#06060a' }}>
      {/* Ambient blurs */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(20,184,166,0.07) 0%, transparent 60%)' }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 60%)' }} />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-8 flex-1 safe-top safe-bottom">
        <div className="flex-1 min-h-[14vh]" />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6"
        >
          <Logo size={56} />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-[36px] font-extrabold tracking-tight leading-none mb-3"
        >
          <span className="gradient-text">Get Drinkr</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-[15px] text-zinc-500 text-center leading-relaxed mb-10"
        >
          Install the app for the full experience
        </motion.p>

        {/* Install instructions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="w-full"
        >
          {canInstallNative ? (
            /* Android / Chrome — native install prompt */
            <button
              onClick={onInstall}
              className="w-full py-[15px] rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 text-black active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)' }}
            >
              <Download className="w-[18px] h-[18px]" />
              Install App
            </button>
          ) : isIOS ? (
            /* iOS — manual instructions */
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-4">
              <p className="text-sm font-medium text-zinc-300 text-center mb-4">Add to your Home Screen</p>
              <Step number={1} icon={<Share className="w-4 h-4" />} text="Tap the Share button in your browser" />
              <Step number={2} icon={<Plus className="w-4 h-4" />} text='Scroll down and tap "Add to Home Screen"' />
              <Step number={3} text="Tap Add to confirm" />
            </div>
          ) : (
            /* Other browsers — generic instructions */
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-4">
              <p className="text-sm font-medium text-zinc-300 text-center mb-4">Install from your browser</p>
              <Step number={1} icon={<MoreVertical className="w-4 h-4" />} text="Tap the menu button in your browser" />
              <Step number={2} icon={<Download className="w-4 h-4" />} text='Tap "Install app" or "Add to Home Screen"' />
            </div>
          )}
        </motion.div>

        <div className="flex-1 min-h-[10vh]" />

        {/* Disclaimer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-[10px] text-zinc-700 text-center max-w-[280px] leading-relaxed pb-6"
        >
          For adults 18+ only. Drink responsibly.
        </motion.p>
      </div>
    </div>
  );
}

function Step({ number, icon, text }: { number: number; icon?: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-accent">{number}</span>
      </div>
      {icon && <div className="text-zinc-400">{icon}</div>}
      <p className="text-sm text-zinc-400">{text}</p>
    </div>
  );
}
