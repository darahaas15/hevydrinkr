'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, LogOut, Trash2, User, Scale, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { pickImage, compressImage, MAX_AVATAR_SIZE, AVATAR_MAX_DIM } from '@/lib/image-utils';

export default function SettingsPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [weight, setWeight] = useState(currentUser?.weightKg?.toString() || '75');
  const [gender, setGender] = useState(currentUser?.gender || 'male');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleChangePhoto = async () => {
    const file = await pickImage();
    if (!file) return;
    const dataUrl = await compressImage(file, MAX_AVATAR_SIZE, AVATAR_MAX_DIM);
    updateProfile({ avatarUrl: dataUrl });
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleDeleteAccount = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (typeof window !== 'undefined') {
      logout();
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('hevydrinkr')) {
          localStorage.removeItem(key);
        }
      });
      window.location.href = '/';
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
                <User className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Username</span>
              </div>
              <span className="text-sm text-zinc-500">@{currentUser?.username}</span>
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Scale className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Weight</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => { setWeight(e.target.value); updateProfile({ weightKg: parseFloat(e.target.value) || 70 }); }}
                  className="w-16 text-right text-sm bg-transparent text-white focus:outline-none font-mono"
                />
                <span className="text-xs text-zinc-600">kg</span>
              </div>
            </div>
            <div className="px-4 py-3.5">
              <p className="text-sm mb-2.5">Gender</p>
              <div className="flex gap-2">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => { setGender(g); updateProfile({ gender: g }); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                      gender === g
                        ? 'bg-accent text-black'
                        : 'bg-white/[0.04] text-zinc-500'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-700 mt-2">Used for drink score calculations</p>
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
              <span className="text-sm text-zinc-600">Local</span>
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
