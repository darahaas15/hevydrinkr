'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Users, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/use-auth-store';
import { useGroupsStore } from '@/stores/use-groups-store';
import type { GroupMember } from '@/types';

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);
  const joinGroup = useGroupsStore((s) => s.joinGroup);

  const [status, setStatus] = useState<'loading' | 'joining' | 'success' | 'error' | 'unauthenticated'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initialize();
    setMounted(true);
  }, [initialize]);

  useEffect(() => {
    if (!mounted || isLoading) return;

    if (!isAuthenticated || !currentUser) {
      setStatus('unauthenticated');
      return;
    }

    // Try to join
    const doJoin = async () => {
      setStatus('joining');
      const member: GroupMember = {
        userId: currentUser.id,
        userName: currentUser.displayName,
        userAvatar: currentUser.avatarUrl,
        role: 'member',
        joinedAt: new Date().toISOString(),
      };

      const success = await joinGroup(code.toUpperCase(), member);
      if (success) {
        setStatus('success');
        setTimeout(() => router.replace('/groups'), 1500);
      } else {
        setStatus('error');
        setErrorMsg('Invalid invite code or already a member');
      }
    };

    doJoin();
  }, [mounted, isLoading, isAuthenticated, currentUser, code, joinGroup, router]);

  return (
    <div className="h-dvh flex items-center justify-center px-6 safe-top safe-bottom" style={{ background: '#09090b' }}>
      <div className="text-center max-w-sm">
        {(status === 'loading' || status === 'joining') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
            <p className="text-sm text-zinc-400">Joining group...</p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
            <CheckCircle className="w-12 h-12 text-accent mb-4" />
            <h2 className="text-xl font-bold mb-2">You're in!</h2>
            <p className="text-sm text-zinc-500">Redirecting to groups...</p>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
            <XCircle className="w-12 h-12 text-red-400 mb-4" />
            <h2 className="text-xl font-bold mb-2">Couldn't join</h2>
            <p className="text-sm text-zinc-500 mb-6">{errorMsg}</p>
            <button
              onClick={() => router.replace('/groups')}
              className="px-6 py-3 rounded-xl bg-accent text-black font-bold text-sm"
            >
              Go to Groups
            </button>
          </motion.div>
        )}

        {status === 'unauthenticated' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
            <Users className="w-12 h-12 text-accent mb-4" />
            <h2 className="text-xl font-bold mb-2">You've been invited!</h2>
            <p className="text-sm text-zinc-500 mb-6">Sign up or log in to join this group</p>
            <button
              onClick={() => router.push(`/?invite=${code}`)}
              className="px-6 py-3 rounded-xl bg-accent text-black font-bold text-sm"
            >
              Get Started
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
