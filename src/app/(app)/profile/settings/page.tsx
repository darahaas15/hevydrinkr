'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, LogOut, Trash2, User, Camera, Type, FileText, Bell, ChevronRight, Scale, Shield, Ruler, Weight, Lock, Sparkles, Sun, Moon, Monitor } from 'lucide-react';
import { useAppRouter } from '@/hooks/use-app-router';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import { useThemeStore } from '@/stores/use-theme-store';
import type { ThemePreference } from '@/lib/theme';
import { useNotificationStore, type NotificationPreferences } from '@/stores/use-notification-store';
import { unregisterPushNotifications } from '@/lib/push-notifications';
import { hapticSelection } from '@/lib/haptics';
import { supabase } from '@/lib/supabase/client';
import { pickImage, uploadImage, MAX_AVATAR_SIZE, AVATAR_MAX_DIM } from '@/lib/image-utils';
import { APP_VERSION } from '@/lib/changelog';

export default function SettingsPage() {
  const router = useAppRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addToast = useUIStore((s) => s.addToast);

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(currentUser?.gender || 'other');
  const [weightInput, setWeightInput] = useState(currentUser?.weightKg?.toString() || '70');
  const [heightInput, setHeightInput] = useState(currentUser?.heightCm?.toString() || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const preferences = useNotificationStore((s) => s.preferences);
  const updatePreferences = useNotificationStore((s) => s.updatePreferences);
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const [showPublicConfirm, setShowPublicConfirm] = useState(false);

  const handleChangePhoto = async () => {
    const file = await pickImage();
    if (!file) return;
    try {
      const url = await uploadImage(file, 'avatars', MAX_AVATAR_SIZE, AVATAR_MAX_DIM);
      updateProfile({ avatarUrl: url });
      addToast('Photo updated', 'success');
    } catch {
      addToast("Couldn't upload photo", 'error');
    }
  };

  const handleSaveDisplayName = () => {
    if (!displayName.trim()) return;
    updateProfile({ displayName: displayName.trim() });
    addToast('Name updated', 'success');
  };

  const handleSaveBio = () => {
    updateProfile({ bio: bio.trim() });
    addToast('Bio updated', 'success');
  };

  const handleSaveGender = (g: 'male' | 'female' | 'other') => {
    setGender(g);
    hapticSelection();
    updateProfile({ gender: g });
    addToast('Gender updated', 'success');
  };

  const handleSaveWeight = () => {
    const wt = parseFloat(weightInput);
    if (isNaN(wt) || wt < 30 || wt > 300) return;
    updateProfile({ weightKg: wt });
    addToast('Weight updated', 'success');
  };

  const handleSaveHeight = () => {
    const ht = parseFloat(heightInput);
    if (isNaN(ht) || ht < 100 || ht > 250) return;
    updateProfile({ heightCm: ht });
    addToast('Height updated', 'success');
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    if (!currentUser) return;
    hapticSelection();
    updatePreferences(currentUser.id, { [key]: !preferences[key] });
  };

  const handleSelectTheme = (value: ThemePreference) => {
    if (value === themePreference) return;
    hapticSelection();
    setThemePreference(value);
  };

  const handleTogglePrivacy = () => {
    if (!currentUser) return;
    hapticSelection();
    if (currentUser.isPrivate) {
      setShowPublicConfirm(true);
    } else {
      updateProfile({ isPrivate: true });
      addToast('Account is now private', 'success');
    }
  };

  const handleConfirmPublic = async () => {
    setShowPublicConfirm(false);
    // The handle_privacy_change DB trigger auto-accepts pending requests, which
    // creates follows rows, which triggers the follow notification path. No
    // client-side invocation of send-notification needed.
    updateProfile({ isPrivate: false });
    addToast('Account is now public', 'success');
  };

  const handleLogout = async () => {
    if (currentUser) await unregisterPushNotifications(currentUser.id);
    await logout();
    router.replace('/');
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (!currentUser) return;
    try {
      // Edge function uses admin API to delete auth.users; cascade through
      // profiles handles all owned content + sets nullable references to NULL.
      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw error;
      await logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch {
      setConfirmDelete(false);
      addToast('Failed to delete account. Try again.', 'error');
    }
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'var(--chrome-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid var(--chrome-border)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 active:text-foreground">
            <ChevronLeft className="w-6 h-6 text-muted-foreground" />
          </button>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* Profile section */}
        <div>
          <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2.5">Profile</h3>
          <div className="rounded-2xl bg-card border border-hairline divide-y divide-border-faint">
            <button
              onClick={handleChangePhoto}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-surface-faint transition-colors"
            >
              <div className="flex items-center gap-3">
                <Camera className="w-4 h-4 text-fg-secondary" />
                <span className="text-sm">Change Photo</span>
              </div>
              <span className="text-sm text-muted">Tap to update</span>
            </button>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Type className="w-4 h-4 text-fg-secondary" />
                <span className="text-sm">Display Name</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={handleSaveDisplayName}
                  className="w-32 text-right text-sm bg-transparent text-foreground focus:outline-none"
                />
              </div>
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-fg-secondary" />
                <span className="text-sm">Username</span>
              </div>
              <span className="text-sm text-fg-secondary">@{currentUser?.username}</span>
            </div>
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-4 h-4 text-fg-secondary" />
                <span className="text-sm">Bio</span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                onBlur={handleSaveBio}
                placeholder="Tell people about yourself..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-card border border-hairline text-sm text-foreground placeholder:text-fg-faint focus:outline-none focus:border-accent/30 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Body Metrics */}
        <div>
          <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">Body Metrics</h3>
          <p className="text-[11px] text-muted mb-2.5">Used for BAC estimation</p>
          <div className="rounded-2xl bg-card border border-hairline divide-y divide-border-faint">
            {/* Gender */}
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-3 mb-2.5">
                <User className="w-4 h-4 text-fg-secondary" />
                <span className="text-sm">Gender</span>
              </div>
              <div className="flex gap-2">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => handleSaveGender(g)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      gender === g
                        ? 'bg-accent/10 ring-1 ring-accent/30 text-accent'
                        : 'bg-card border border-card-border text-fg-secondary'
                    }`}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Height */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Ruler className="w-4 h-4 text-fg-secondary" />
                <span className="text-sm">Height</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  onBlur={handleSaveHeight}
                  placeholder="170"
                  className="w-16 text-right text-sm bg-transparent text-foreground focus:outline-none"
                />
                <span className="text-xs text-muted">cm</span>
              </div>
            </div>

            {/* Weight */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Weight className="w-4 h-4 text-fg-secondary" />
                <span className="text-sm">Weight</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onBlur={handleSaveWeight}
                  placeholder="70"
                  className="w-16 text-right text-sm bg-transparent text-foreground focus:outline-none"
                />
                <span className="text-xs text-muted">kg</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted px-1 mt-2">BAC estimates are approximate and should not be used for legal or medical decisions.</p>
        </div>

        {/* Privacy */}
        <div>
          <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">Privacy</h3>
          <p className="text-[11px] text-muted mb-2.5">Control who can see your sessions and posts</p>
          <div className="rounded-2xl bg-card border border-hairline divide-y divide-border-faint">
            <button
              onClick={handleTogglePrivacy}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-surface-faint transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-fg-secondary" />
                <div className="text-left">
                  <span className="text-sm block">Private Account</span>
                  <span className="text-[11px] text-muted">Only approved followers can see your sessions and posts</span>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${currentUser?.isPrivate ? 'bg-accent' : 'bg-track'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${currentUser?.isPrivate ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div>
          <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2.5">Notifications</h3>
          <div className="rounded-2xl bg-card border border-hairline divide-y divide-border-faint">
            {([
              ['likesEnabled', 'Likes', 'When someone likes your post'] as const,
              ['commentsEnabled', 'Comments & Replies', 'When someone comments or replies'] as const,
              ['newPostsEnabled', 'New Posts', 'When someone you follow posts'] as const,
              ['followsEnabled', 'New Followers', 'When someone follows you'] as const,
              ['tagsEnabled', 'Tags', 'When someone tags you in a post'] as const,
              ['groupJoinsEnabled', 'Group Activity', 'When someone joins your group'] as const,
              ['roastsEnabled', 'Weekly Stats', 'Weekly group stats drops'] as const,
              ['sessionRemindersEnabled', 'Session Reminders', '2-hour session check-in'] as const,
            ]).map(([key, label, desc]) => (
              <button
                key={key}
                onClick={() => handleTogglePref(key)}
                className="w-full px-4 py-3.5 flex items-center justify-between active:bg-surface-faint transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-fg-secondary" />
                  <div className="text-left">
                    <span className="text-sm block">{label}</span>
                    <span className="text-[11px] text-muted">{desc}</span>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${preferences[key] ? 'bg-accent' : 'bg-track'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${preferences[key] ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Appearance */}
        <div>
          <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2.5">Appearance</h3>
          <div className="rounded-2xl bg-card border border-card-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <Sun className="w-4 h-4 text-fg-secondary" />
              <span className="text-sm">Theme</span>
            </div>
            <div className="flex gap-2">
              {([
                ['system', 'System', Monitor],
                ['light', 'Light', Sun],
                ['dark', 'Dark', Moon],
              ] as const).map(([value, label, Icon]) => {
                const isActive = themePreference === value;
                return (
                  <button
                    key={value}
                    onClick={() => handleSelectTheme(value)}
                    aria-pressed={isActive}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-accent-muted ring-1 ring-accent/40 text-accent-text'
                        : 'bg-card-hover border border-card-border text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted mt-3">System follows your device&apos;s appearance setting.</p>
          </div>
        </div>

        {/* Legal */}
        <div>
          <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2.5">Legal</h3>
          <div className="rounded-2xl bg-card border border-hairline divide-y divide-border-faint">
            <button
              onClick={() => router.push('/legal/terms')}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-surface-faint transition-colors"
            >
              <div className="flex items-center gap-3">
                <Scale className="w-4 h-4 text-fg-secondary" />
                <span className="text-sm">Terms of Service</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted" />
            </button>
            <button
              onClick={() => router.push('/legal/privacy')}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-surface-faint transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-fg-secondary" />
                <span className="text-sm">Privacy Policy</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted" />
            </button>
          </div>
        </div>

        {/* About */}
        <div>
          <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2.5">About</h3>
          <div className="rounded-2xl bg-card border border-hairline divide-y divide-border-faint">
            <button
              onClick={() => router.push('/changelog')}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-surface-faint transition-colors"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-fg-secondary" />
                <span className="text-sm">What&apos;s New</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted" />
            </button>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm text-muted">{APP_VERSION}</span>
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Contact</span>
              <span className="text-sm text-muted">support@drinkr.app</span>
            </div>
          </div>
        </div>

        {/* Responsible Drinking */}
        <div>
          <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2.5">Responsible Drinking</h3>
          <div className="rounded-2xl bg-card border border-hairline p-4">
            <p className="text-xs text-fg-secondary leading-relaxed">
              Drinkr is for informational and social purposes only. It does not encourage excessive alcohol consumption. All drink counts and statistics are estimates and should not be used for medical or legal purposes.
            </p>
            <p className="text-xs text-fg-secondary leading-relaxed mt-2">
              If you or someone you know needs help with alcohol use, contact the SAMHSA helpline at <span className="text-accent">1-800-662-4357</span> (free, confidential, 24/7).
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="w-full py-3.5 rounded-xl bg-card border border-hairline flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </motion.button>
        </div>

        {/* Danger zone */}
        <div className="pt-4">
          <h3 className="text-[10px] font-semibold text-danger-fg/60 uppercase tracking-wider mb-2.5">Danger Zone</h3>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleDeleteAccount}
            className="w-full py-3.5 rounded-xl bg-red-500/[0.06] border border-red-500/10 flex items-center justify-center gap-2 text-sm text-danger-fg"
          >
            <Trash2 className="w-4 h-4" />
            {confirmDelete ? 'Tap again to confirm' : 'Delete Account'}
          </motion.button>
          <p className="text-[10px] text-fg-faint mt-2 text-center">This will permanently delete all your data</p>
        </div>
      </div>

      {/* Public confirmation modal */}
      <AnimatePresence>
        {showPublicConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowPublicConfirm(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-xs mx-6 rounded-3xl p-6 text-center"
              style={{ background: 'var(--popover-strong-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', border: '1px solid var(--chrome-border)' }}
            >
              <Lock className="w-8 h-8 text-fg-secondary mx-auto mb-3" />
              <h3 className="text-base font-bold mb-2">Switch to Public?</h3>
              <p className="text-xs text-fg-secondary mb-5">All pending follow requests will be automatically accepted. Your posts and sessions will be visible to everyone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPublicConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surface-raised border border-border-strong text-sm font-semibold text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPublic}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-sm font-semibold text-accent-foreground"
                >
                  Switch
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
