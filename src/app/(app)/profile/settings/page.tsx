'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, LogOut, Trash2, User, Camera, Type, FileText, Bell, ChevronRight, Scale, Shield, Ruler, Weight, Lock } from 'lucide-react';
import { useAppRouter } from '@/hooks/use-app-router';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import { useNotificationStore, type NotificationPreferences } from '@/stores/use-notification-store';
import { unregisterPushNotifications } from '@/lib/push-notifications';
import { hapticSelection } from '@/lib/haptics';
import { supabase } from '@/lib/supabase/client';
import { pickImage, compressImage, MAX_AVATAR_SIZE, AVATAR_MAX_DIM } from '@/lib/image-utils';

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
  const [showPublicConfirm, setShowPublicConfirm] = useState(false);

  const handleChangePhoto = async () => {
    const file = await pickImage();
    if (!file) return;
    const dataUrl = await compressImage(file, MAX_AVATAR_SIZE, AVATAR_MAX_DIM);
    updateProfile({ avatarUrl: dataUrl });
    addToast('Photo updated', 'success');
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

    const { data: pendingRequests } = await supabase
      .from('follow_requests')
      .select('requester_id')
      .eq('target_id', currentUser!.id)
      .eq('status', 'pending');

    updateProfile({ isPrivate: false });

    if (pendingRequests && pendingRequests.length > 0) {
      for (const req of pendingRequests) {
        supabase.functions.invoke('send-notification', {
          body: {
            recipientId: req.requester_id,
            type: 'follow_request_accepted',
            title: 'Follow Request Accepted',
            body: `@${currentUser!.username} accepted your follow request`,
            data: { userId: currentUser!.id },
          },
        }).catch(() => {});
      }
    }

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
      // Delete user data from Supabase (cascading deletes handle related rows)
      await supabase.from('follows').delete().or(`follower_id.eq.${currentUser.id},following_id.eq.${currentUser.id}`);
      await supabase.from('feed_items').delete().eq('user_id', currentUser.id);
      await supabase.from('drink_sessions').delete().eq('user_id', currentUser.id);
      await supabase.from('personal_records').delete().eq('user_id', currentUser.id);
      await supabase.from('device_tokens').delete().eq('user_id', currentUser.id);
      await supabase.from('notifications').delete().eq('user_id', currentUser.id);
      await supabase.from('notification_preferences').delete().eq('user_id', currentUser.id);
      await supabase.from('profiles').delete().eq('id', currentUser.id);
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
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 active:text-white">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* Profile section */}
        <div>
          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5">Profile</h3>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04]">
            <button
              onClick={handleChangePhoto}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Camera className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Change Photo</span>
              </div>
              <span className="text-sm text-zinc-600">Tap to update</span>
            </button>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Type className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Display Name</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={handleSaveDisplayName}
                  className="w-32 text-right text-sm bg-transparent text-white focus:outline-none"
                />
              </div>
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Username</span>
              </div>
              <span className="text-sm text-zinc-500">@{currentUser?.username}</span>
            </div>
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Bio</span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                onBlur={handleSaveBio}
                placeholder="Tell people about yourself..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-accent/30 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Body Metrics */}
        <div>
          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">Body Metrics</h3>
          <p className="text-[11px] text-zinc-600 mb-2.5">Used for BAC estimation</p>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04]">
            {/* Gender */}
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-3 mb-2.5">
                <User className="w-4 h-4 text-zinc-500" />
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
                        : 'bg-white/[0.03] border border-white/[0.06] text-zinc-500'
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
                <Ruler className="w-4 h-4 text-zinc-500" />
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
                  className="w-16 text-right text-sm bg-transparent text-white focus:outline-none"
                />
                <span className="text-xs text-zinc-600">cm</span>
              </div>
            </div>

            {/* Weight */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Weight className="w-4 h-4 text-zinc-500" />
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
                  className="w-16 text-right text-sm bg-transparent text-white focus:outline-none"
                />
                <span className="text-xs text-zinc-600">kg</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 px-1 mt-2">BAC estimates are approximate and should not be used for legal or medical decisions.</p>
        </div>

        {/* Privacy */}
        <div>
          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">Privacy</h3>
          <p className="text-[11px] text-zinc-600 mb-2.5">Control who can see your sessions and posts</p>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04]">
            <button
              onClick={handleTogglePrivacy}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-zinc-500" />
                <div className="text-left">
                  <span className="text-sm block">Private Account</span>
                  <span className="text-[11px] text-zinc-600">Only approved followers can see your sessions and posts</span>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${currentUser?.isPrivate ? 'bg-teal-500' : 'bg-zinc-700'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${currentUser?.isPrivate ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div>
          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5">Notifications</h3>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04]">
            {([
              ['likesEnabled', 'Likes', 'When someone likes your post'] as const,
              ['commentsEnabled', 'Comments & Replies', 'When someone comments or replies'] as const,
              ['newPostsEnabled', 'New Posts', 'When someone you follow posts'] as const,
              ['followsEnabled', 'New Followers', 'When someone follows you'] as const,
              ['groupJoinsEnabled', 'Group Activity', 'When someone joins your group'] as const,
              ['roastsEnabled', 'Weekly Stats', 'Weekly group stats drops'] as const,
              ['sessionRemindersEnabled', 'Session Reminders', '2-hour session check-in'] as const,
            ]).map(([key, label, desc]) => (
              <button
                key={key}
                onClick={() => handleTogglePref(key)}
                className="w-full px-4 py-3.5 flex items-center justify-between active:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-zinc-500" />
                  <div className="text-left">
                    <span className="text-sm block">{label}</span>
                    <span className="text-[11px] text-zinc-600">{desc}</span>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${preferences[key] ? 'bg-teal-500' : 'bg-zinc-700'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${preferences[key] ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Legal */}
        <div>
          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5">Legal</h3>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04]">
            <button
              onClick={() => router.push('/legal/terms')}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Scale className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Terms of Service</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600" />
            </button>
            <button
              onClick={() => router.push('/legal/privacy')}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Privacy Policy</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600" />
            </button>
          </div>
        </div>

        {/* About */}
        <div>
          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5">About</h3>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04]">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm text-zinc-400">Version</span>
              <span className="text-sm text-zinc-600">1.12.0</span>
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm text-zinc-400">Contact</span>
              <span className="text-sm text-zinc-600">support@drinkr.app</span>
            </div>
          </div>
        </div>

        {/* Responsible Drinking */}
        <div>
          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5">Responsible Drinking</h3>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Drinkr is for informational and social purposes only. It does not encourage excessive alcohol consumption. All drink counts and statistics are estimates and should not be used for medical or legal purposes.
            </p>
            <p className="text-xs text-zinc-500 leading-relaxed mt-2">
              If you or someone you know needs help with alcohol use, contact the SAMHSA helpline at <span className="text-accent">1-800-662-4357</span> (free, confidential, 24/7).
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="w-full py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center gap-2 text-sm text-zinc-400"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </motion.button>
        </div>

        {/* Danger zone */}
        <div className="pt-4">
          <h3 className="text-[10px] font-semibold text-red-400/60 uppercase tracking-wider mb-2.5">Danger Zone</h3>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleDeleteAccount}
            className="w-full py-3.5 rounded-xl bg-red-500/[0.06] border border-red-500/10 flex items-center justify-center gap-2 text-sm text-red-400"
          >
            <Trash2 className="w-4 h-4" />
            {confirmDelete ? 'Tap again to confirm' : 'Delete Account'}
          </motion.button>
          <p className="text-[10px] text-zinc-700 mt-2 text-center">This will permanently delete all your data</p>
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
              style={{ background: 'rgba(20,20,24,0.95)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Lock className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
              <h3 className="text-base font-bold mb-2">Switch to Public?</h3>
              <p className="text-xs text-zinc-500 mb-5">All pending follow requests will be automatically accepted. Your posts and sessions will be visible to everyone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPublicConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm font-semibold text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPublic}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-sm font-semibold text-black"
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
