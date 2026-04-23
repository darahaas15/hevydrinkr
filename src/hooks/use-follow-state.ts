'use client';

import { useCallback } from 'react';
import { useAuthStore } from '@/stores/use-auth-store';

export type FollowState = 'following' | 'pending' | 'none' | 'self';

export interface FollowStateResult {
  state: FollowState;
  label: string;
  onClick: () => void;
}

// Three-way follow state with the correct action bound.
// `self` callers should hide the button.
export function useFollowState(targetUserId: string): FollowStateResult {
  const currentUserId = useAuthStore((s) => s.currentUser?.id);
  const isFollowing = useAuthStore((s) =>
    !!s.currentUser?.following.includes(targetUserId)
  );
  const isPending = useAuthStore((s) =>
    s.outgoingRequests.some((r) => r.targetId === targetUserId)
  );
  const toggleFollow = useAuthStore((s) => s.toggleFollow);
  const cancelFollowRequest = useAuthStore((s) => s.cancelFollowRequest);

  const isSelf = currentUserId === targetUserId;

  const state: FollowState = isSelf
    ? 'self'
    : isFollowing
      ? 'following'
      : isPending
        ? 'pending'
        : 'none';

  const onClick = useCallback(() => {
    if (state === 'self') return;
    if (state === 'pending') {
      cancelFollowRequest(targetUserId);
    } else {
      toggleFollow(targetUserId);
    }
  }, [state, targetUserId, toggleFollow, cancelFollowRequest]);

  const label =
    state === 'following' ? 'Following' :
    state === 'pending' ? 'Requested' :
    'Follow';

  return { state, label, onClick };
}
