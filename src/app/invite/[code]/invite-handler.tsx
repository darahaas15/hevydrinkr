'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Users, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/use-auth-store';
import { useGroupsStore } from '@/stores/use-groups-store';
import type { GroupMember } from '@/types';
import { useRouteParam } from '@/hooks/use-route-param';

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const code = useRouteParam(params, 'code');
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);
  const joinGroup = useGroupsStore((s) => s.joinGroup);

  const [joinStatus, setJoinStatus] = useState<'joining' | 'success' | 'error'>('joining');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Auth state decides the first two screens; only the join attempt needs state.
  const signedIn = isAuthenticated && !!currentUser;
  const status = isLoading ? 'loading' : !signedIn ? 'unauthenticated' : joinStatus;

  useEffect(() => {
    if (isLoading || !isAuthenticated || !currentUser) return;

    // Try to join
    const doJoin = async () => {
      setJoinStatus('joining');
      const member: GroupMember = {
        userId: currentUser.id,
        userName: currentUser.displayName,
        userAvatar: currentUser.avatarUrl,
        role: 'member',
        joinedAt: new Date().toISOString(),
      };

      const success = await joinGroup(code.toUpperCase(), member);
      if (success) {
        setJoinStatus('success');
        setTimeout(() => router.replace('/groups'), 1500);
      } else {
        setJoinStatus('error');
        setErrorMsg('Invalid invite code or already a member');
      }
    };

    doJoin();
  }, [isLoading, isAuthenticated, currentUser, code, joinGroup, router]);

  return (
    <div className="h-dvh flex items-center justify-center px-6 safe-top safe-bottom" style={{ background: 'var(--background)' }}>
      <div className="text-center max-w-sm">
        {(status === 'loading' || status === 'joining') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Joining group...</p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
            <CheckCircle className="w-12 h-12 text-accent mb-4" />
            <h2 className="text-xl font-bold mb-2">You&apos;re in!</h2>
            <p className="text-sm text-fg-secondary">Redirecting to groups...</p>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
            <XCircle className="w-12 h-12 text-danger-fg mb-4" />
            <h2 className="text-xl font-bold mb-2">Couldn&apos;t join</h2>
            <p className="text-sm text-fg-secondary mb-6">{errorMsg}</p>
            <button
              onClick={() => router.replace('/groups')}
              className="px-6 py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm"
            >
              Go to Groups
            </button>
          </motion.div>
        )}

        {status === 'unauthenticated' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
            <Users className="w-12 h-12 text-accent mb-4" />
            <h2 className="text-xl font-bold mb-2">You&apos;ve been invited!</h2>
            <p className="text-sm text-fg-secondary mb-6">Sign up or log in to join this group</p>
            <button
              onClick={() => router.push(`/?invite=${code}`)}
              className="px-6 py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm"
            >
              Get Started
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
