import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase/client';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'underage'
  | 'dangerous'
  | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'underage', label: 'Underage user' },
  { value: 'dangerous', label: 'Dangerous or harmful behavior' },
  { value: 'other', label: 'Other' },
];

interface ModerationState {
  blockedUserIds: string[];

  reportContent: (params: {
    reporterId: string;
    targetType: 'post' | 'comment' | 'user';
    targetId: string;
    reason: ReportReason;
    details?: string;
  }) => Promise<boolean>;

  blockUser: (currentUserId: string, blockedUserId: string) => Promise<void>;
  unblockUser: (currentUserId: string, blockedUserId: string) => Promise<void>;
  fetchBlockedUsers: (userId: string) => Promise<void>;
  isBlocked: (userId: string) => boolean;
}

export const useModerationStore = create<ModerationState>()(persist((set, get) => ({
  blockedUserIds: [],

  reportContent: async ({ reporterId, targetType, targetId, reason, details }) => {
    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details || '',
      });

    return !error;
  },

  blockUser: async (currentUserId, blockedUserId) => {
    // Optimistic update
    set((s) => ({ blockedUserIds: [...s.blockedUserIds, blockedUserId] }));

    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: currentUserId, blocked_id: blockedUserId });

    if (error) {
      // Roll back
      set((s) => ({ blockedUserIds: s.blockedUserIds.filter((id) => id !== blockedUserId) }));
    }
  },

  unblockUser: async (currentUserId, blockedUserId) => {
    const prev = get().blockedUserIds;
    set((s) => ({ blockedUserIds: s.blockedUserIds.filter((id) => id !== blockedUserId) }));

    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', blockedUserId);

    if (error) {
      set({ blockedUserIds: prev });
    }
  },

  fetchBlockedUsers: async (userId) => {
    const { data } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId);

    if (data) {
      set({ blockedUserIds: data.map((r) => r.blocked_id) });
    }
  },

  isBlocked: (userId) => get().blockedUserIds.includes(userId),
}), {
  name: 'hd-moderation',
  partialize: (s) => ({ blockedUserIds: s.blockedUserIds }),
}));
