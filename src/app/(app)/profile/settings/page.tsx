'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, LogOut, Trash2, User, Camera, Type, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import { supabase } from '@/lib/supabase/client';
import { pickImage, compressImage, MAX_AVATAR_SIZE, AVATAR_MAX_DIM } from '@/lib/image-utils';

export default function SettingsPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addToast = useUIStore((s) => s.addToast);

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleLogout = async () => {
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
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
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

        {/* About */}
        <div>
          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5">About</h3>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04]">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm text-zinc-400">Version</span>
              <span className="text-sm text-zinc-600">1.0.0</span>
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm text-zinc-400">Storage</span>
              <span className="text-sm text-zinc-600">Supabase</span>
            </div>
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
    </div>
  );
}
