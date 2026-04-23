'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, UserPlus, Check, X } from 'lucide-react';
import { useAppRouter } from '@/hooks/use-app-router';
import { useAuthStore } from '@/stores/use-auth-store';
import { Avatar } from '@/components/ui/avatar';
import { hapticLight } from '@/lib/haptics';

export default function FollowRequestsPage() {
  const router = useAppRouter();
  const followRequests = useAuthStore((s) => s.followRequests);
  const fetchFollowRequests = useAuthStore((s) => s.fetchFollowRequests);
  const acceptFollowRequest = useAuthStore((s) => s.acceptFollowRequest);
  const rejectFollowRequest = useAuthStore((s) => s.rejectFollowRequest);

  useEffect(() => {
    fetchFollowRequests();
  }, [fetchFollowRequests]);

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 active:text-white">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <h1 className="text-lg font-bold">Follow Requests</h1>
        </div>
      </div>

      <div className="px-5 py-3">
        {followRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <UserPlus className="w-8 h-8 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-600">No pending requests</p>
          </div>
        ) : (
          <AnimatePresence>
          <div className="space-y-1">
            {followRequests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 py-3 px-1"
              >
                <div
                  onClick={() => router.push(`/profile/${request.requesterId}`)}
                  className="cursor-pointer"
                >
                  <Avatar
                    name={request.requesterProfile?.displayName || ''}
                    size="md"
                    src={request.requesterProfile?.avatarUrl || null}
                  />
                </div>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => router.push(`/profile/${request.requesterId}`)}
                >
                  <p className="text-sm font-semibold truncate">
                    {request.requesterProfile?.displayName || 'Unknown'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    @{request.requesterProfile?.username || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { hapticLight(); acceptFollowRequest(request.id); }}
                    className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-black" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { hapticLight(); rejectFollowRequest(request.id); }}
                    className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
