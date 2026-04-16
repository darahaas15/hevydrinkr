import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeedItem } from '@/types';
import type {
  RoastRecap,
  RoastAward,
  RoastStreak,
  GroupRecord,
  GroupRecordType,
  RoastRecapSummary,
} from '@/types/roast';
import type { GroupMember } from '@/types/group';
import { supabase } from '@/lib/supabase/client';
import { computeWeeklyAwards, type MemberWeekData } from '@/lib/algorithms/roast-engine';
import { getAwardMeta } from '@/lib/algorithms/roast-copy';
import { useUIStore } from '@/stores/use-ui-store';
import { safeJSONStorage } from '@/lib/storage/safe-storage';

// ── Week helpers ──

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getPreviousWeekKey(weekKey: string): string {
  const { start } = getWeekBounds(weekKey);
  const prevWeekDate = new Date(start.getTime() - 7 * 86400000);
  return getWeekKey(prevWeekDate);
}

function getWeekBounds(weekKey: string): { start: Date; end: Date } {
  const [yearStr, weekPart] = weekKey.split('-W');
  const year = parseInt(yearStr);
  const weekNum = parseInt(weekPart);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
  const start = new Date(startOfWeek1);
  start.setDate(startOfWeek1.getDate() + (weekNum - 1) * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

// ── Store ──

interface RoastState {
  recaps: RoastRecap[];
  streaks: RoastStreak[];
  records: GroupRecord[];
  loading: boolean;
  generating: boolean;

  fetchRecaps: (groupId: string) => Promise<void>;
  fetchStreaks: (groupId: string) => Promise<void>;
  fetchRecords: (groupId: string) => Promise<void>;
  generateRoast: (groupId: string, weekKey: string, members: GroupMember[]) => Promise<RoastRecap | null>;
  refreshRecords: (groupId: string, members: GroupMember[]) => Promise<void>;
  refreshRecap: (groupId: string, weekKey: string, members: GroupMember[]) => Promise<void>;
  getRecapsByGroup: (groupId: string) => RoastRecap[];
  getLatestRecap: (groupId: string) => RoastRecap | undefined;
  getCurrentWeekKey: () => string;
  getLastWeekKey: () => string;
  hasRecapForWeek: (groupId: string, weekKey: string) => boolean;
}

function mapDbAward(row: Record<string, unknown>): RoastAward {
  const profile = row.profile as { display_name?: string; avatar_url?: string | null } | null;
  return {
    id: row.id as string,
    recapId: row.recap_id as string,
    userId: row.user_id as string,
    userName: profile?.display_name ?? 'Unknown',
    userAvatar: profile?.avatar_url ?? null,
    awardType: row.award_type as RoastAward['awardType'],
    title: row.title as string,
    roastLine: row.roast_line as string,
    statValue: (row.stat_value as number) ?? null,
    statLabel: (row.stat_label as string) ?? null,
    emoji: row.emoji as string,
  };
}

export const useRoastStore = create<RoastState>()(
  persist(
    (set, get) => ({
      recaps: [],
      streaks: [],
      records: [],
      loading: false,
      generating: false,

      fetchRecaps: async (groupId) => {
        set({ loading: true });
        const { data, error } = await supabase
          .from('roast_recaps')
          .select(
            `*, roast_awards(*, profile:profiles!roast_awards_user_id_fkey(display_name, avatar_url))`
          )
          .eq('group_id', groupId)
          .order('week_key', { ascending: false })
          .limit(12);

        if (error) {
          console.error('Failed to fetch recaps:', error);
          set({ loading: false });
          return;
        }

        const fetched: RoastRecap[] = (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          groupId: row.group_id as string,
          weekKey: row.week_key as string,
          weekStart: row.week_start as string,
          weekEnd: row.week_end as string,
          awards: ((row.roast_awards as Record<string, unknown>[]) ?? []).map(mapDbAward),
          summary: row.summary as RoastRecapSummary,
          createdAt: row.created_at as string,
        }));

        set((state) => {
          const otherRecaps = state.recaps.filter((r) => r.groupId !== groupId);
          return { recaps: [...otherRecaps, ...fetched], loading: false };
        });
      },

      fetchStreaks: async (groupId) => {
        const { data, error } = await supabase
          .from('roast_streaks')
          .select(
            `*, profile:profiles!roast_streaks_user_id_fkey(display_name, avatar_url)`
          )
          .eq('group_id', groupId)
          .gte('current_count', 2)
          .order('current_count', { ascending: false });

        if (error) {
          console.error('Failed to fetch streaks:', error);
          return;
        }

        const fetched: RoastStreak[] = (data ?? []).map((row: Record<string, unknown>) => {
          const profile = row.profile as { display_name?: string; avatar_url?: string | null } | null;
          return {
            id: row.id as string,
            groupId: row.group_id as string,
            userId: row.user_id as string,
            userName: profile?.display_name ?? 'Unknown',
            userAvatar: profile?.avatar_url ?? null,
            awardType: row.award_type as RoastStreak['awardType'],
            awardTitle: row.award_title as string,
            currentCount: row.current_count as number,
            longestCount: row.longest_count as number,
            lastWeekKey: row.last_week_key as string,
          };
        });

        set((state) => {
          const otherStreaks = state.streaks.filter((s) => s.groupId !== groupId);
          return { streaks: [...otherStreaks, ...fetched] };
        });
      },

      fetchRecords: async (groupId) => {
        const { data, error } = await supabase
          .from('group_records')
          .select(
            `*, profile:profiles!group_records_user_id_fkey(display_name, avatar_url)`
          )
          .eq('group_id', groupId);

        if (error) {
          console.error('Failed to fetch records:', error);
          return;
        }

        const fetched: GroupRecord[] = (data ?? []).map((row: Record<string, unknown>) => {
          const profile = row.profile as { display_name?: string; avatar_url?: string | null } | null;
          return {
            id: row.id as string,
            groupId: row.group_id as string,
            recordType: row.record_type as GroupRecordType,
            userId: row.user_id as string,
            userName: profile?.display_name ?? 'Unknown',
            userAvatar: profile?.avatar_url ?? null,
            value: row.value as number,
            formattedValue: row.formatted_value as string,
            weekKey: row.week_key as string,
            achievedAt: row.achieved_at as string,
          };
        });

        set((state) => {
          const otherRecords = state.records.filter((r) => r.groupId !== groupId);
          return { records: [...otherRecords, ...fetched] };
        });
      },

      generateRoast: async (groupId, weekKey, members) => {
        // Already exists?
        if (get().hasRecapForWeek(groupId, weekKey)) {
          return get().recaps.find((r) => r.groupId === groupId && r.weekKey === weekKey) ?? null;
        }

        set({ generating: true });

        try {
          const { start, end } = getWeekBounds(weekKey);
          const memberIds = members.map((m) => m.userId);

          // Fetch feed items for all members in this week
          const { data: posts, error: postsError } = await supabase
            .from('feed_items')
            .select('id, user_id, session_summary, created_at')
            .in('user_id', memberIds)
            .gte('created_at', start.toISOString())
            .lt('created_at', end.toISOString());

          if (postsError) {
            console.error('Failed to fetch posts for roast:', postsError);
            set({ generating: false });
            useUIStore.getState().addToast('Something went wrong', 'error');
            return null;
          }

          // Build per-member data
          const memberData: MemberWeekData[] = members.map((m) => ({
            userId: m.userId,
            userName: m.userName,
            userAvatar: m.userAvatar,
            posts: (posts ?? [])
              .filter((p) => (p.user_id as string) === m.userId)
              .map((p) => ({
                id: p.id as string,
                userId: p.user_id as string,
                userName: m.userName,
                userAvatar: m.userAvatar,
                sessionId: '',
                sessionSummary: p.session_summary as FeedItem['sessionSummary'],
                photos: [],
                caption: '',
                likes: [],
                comments: [],
                createdAt: p.created_at as string,
              })),
          }));

          // Compute awards
          const { awards, summary } = computeWeeklyAwards(memberData, weekKey);

          // Add week-over-week change
          const prevWeekKey = getPreviousWeekKey(weekKey);
          const prevRecap = get().recaps.find((r) => r.groupId === groupId && r.weekKey === prevWeekKey);
          if (prevRecap && prevRecap.summary.totalGroupStandardDrinks > 0) {
            const prev = prevRecap.summary.totalGroupStandardDrinks;
            summary.weekOverWeekChange = Math.round(((summary.totalGroupStandardDrinks - prev) / prev) * 100);
          }

          if (awards.length === 0 && summary.participatingMemberCount === 0) {
            set({ generating: false });
            return null;
          }

          // Persist recap
          const recapId = crypto.randomUUID();
          const { error: recapError } = await supabase.from('roast_recaps').insert({
            id: recapId,
            group_id: groupId,
            week_key: weekKey,
            week_start: start.toISOString(),
            week_end: end.toISOString(),
            summary,
          });

          if (recapError) {
            // Likely unique constraint - another client beat us; fetch instead
            if (recapError.code === '23505') {
              await get().fetchRecaps(groupId);
              set({ generating: false });
              return get().recaps.find((r) => r.groupId === groupId && r.weekKey === weekKey) ?? null;
            }
            console.error('Failed to create recap:', recapError);
            set({ generating: false });
            return null;
          }

          // Persist awards
          if (awards.length > 0) {
            const awardRows = awards.map((a) => ({
              id: crypto.randomUUID(),
              recap_id: recapId,
              user_id: a.userId,
              award_type: a.awardType,
              title: a.title,
              roast_line: a.roastLine,
              stat_value: a.statValue,
              stat_label: a.statLabel,
              emoji: a.emoji,
            }));

            const { error: awardsError } = await supabase.from('roast_awards').insert(awardRows);
            if (awardsError) console.error('Failed to insert awards:', awardsError);
          }

          // Update streaks
          for (const award of awards) {
            const prevStreakWeekKey = getPreviousWeekKey(weekKey);
            const { data: existing } = await supabase
              .from('roast_streaks')
              .select('*')
              .eq('group_id', groupId)
              .eq('user_id', award.userId)
              .eq('award_type', award.awardType)
              .maybeSingle();

            if (existing) {
              const wasConsecutive = (existing.last_week_key as string) === prevStreakWeekKey;
              const newCount = wasConsecutive ? (existing.current_count as number) + 1 : 1;
              const newLongest = Math.max(existing.longest_count as number, newCount);

              await supabase
                .from('roast_streaks')
                .update({
                  current_count: newCount,
                  longest_count: newLongest,
                  last_week_key: weekKey,
                  award_title: award.title,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
            } else {
              await supabase.from('roast_streaks').insert({
                group_id: groupId,
                user_id: award.userId,
                award_type: award.awardType,
                award_title: award.title,
                current_count: 1,
                longest_count: 1,
                last_week_key: weekKey,
              });
            }
          }

          // Update group records
          const recordCandidates: { type: GroupRecordType; userId: string; value: number; formatted: string }[] = [];
          for (const md of memberData) {
            if (md.posts.length === 0) continue;
            const totalStd = md.posts.reduce((sum, p) => sum + (p.sessionSummary.totalStandardDrinks ?? 0), 0);
            const sessionCount = md.posts.length;
            const longestSession = md.posts.reduce((max, p) => Math.max(max, p.sessionSummary.durationMinutes ?? 0), 0);
            const maxSessionStd = md.posts.reduce((max, p) => Math.max(max, p.sessionSummary.totalStandardDrinks ?? 0), 0);
            const uniqueDrinks = new Set(md.posts.flatMap((p) => (p.sessionSummary.drinks ?? []).map((d) => d.name)));

            recordCandidates.push(
              { type: 'highest_weekly_std_drinks', userId: md.userId, value: totalStd, formatted: `${Math.round(totalStd * 10) / 10} standards` },
              { type: 'most_weekly_sessions', userId: md.userId, value: sessionCount, formatted: `${sessionCount} sessions` },
              { type: 'longest_single_session', userId: md.userId, value: longestSession, formatted: formatDuration(longestSession) },
              { type: 'highest_single_session_std_drinks', userId: md.userId, value: maxSessionStd, formatted: `${Math.round(maxSessionStd * 10) / 10} standards` },
              { type: 'most_weekly_unique_drinks', userId: md.userId, value: uniqueDrinks.size, formatted: `${uniqueDrinks.size} unique drinks` },
            );
          }

          for (const candidate of recordCandidates) {
            const existing = get().records.find((r) => r.groupId === groupId && r.recordType === candidate.type);
            if (!existing || candidate.value > existing.value) {
              await supabase
                .from('group_records')
                .upsert(
                  {
                    group_id: groupId,
                    record_type: candidate.type,
                    user_id: candidate.userId,
                    value: candidate.value,
                    formatted_value: candidate.formatted,
                    week_key: weekKey,
                    achieved_at: new Date().toISOString(),
                  },
                  { onConflict: 'group_id,record_type' }
                );
            }
          }

          // Build local recap object
          const recap: RoastRecap = {
            id: recapId,
            groupId,
            weekKey,
            weekStart: start.toISOString(),
            weekEnd: end.toISOString(),
            awards: awards.map((a) => ({ ...a, id: crypto.randomUUID(), recapId })),
            summary,
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            recaps: [recap, ...state.recaps],
            generating: false,
          }));

          // Refresh streaks and records
          await Promise.all([get().fetchStreaks(groupId), get().fetchRecords(groupId)]);

          return recap;
        } catch (err) {
          console.error('Roast generation failed:', err);
          set({ generating: false });
          useUIStore.getState().addToast('Something went wrong', 'error');
          return null;
        }
      },

      refreshRecords: async (groupId, members) => {
        const weekKey = getWeekKey(new Date());
        const { start, end } = getWeekBounds(weekKey);
        const memberIds = members.map((m) => m.userId);

        const { data: posts } = await supabase
          .from('feed_items')
          .select('id, user_id, session_summary, created_at')
          .in('user_id', memberIds)
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString());

        if (!posts || posts.length === 0) return;

        const recordCandidates: { type: GroupRecordType; userId: string; value: number; formatted: string }[] = [];
        for (const member of members) {
          const memberPosts = posts.filter((p) => (p.user_id as string) === member.userId);
          if (memberPosts.length === 0) continue;
          const summary = memberPosts.map((p) => p.session_summary as FeedItem['sessionSummary']);
          const totalStd = summary.reduce((sum, s) => sum + (s.totalStandardDrinks ?? 0), 0);
          const longestSession = summary.reduce((max, s) => Math.max(max, s.durationMinutes ?? 0), 0);
          const maxSessionStd = summary.reduce((max, s) => Math.max(max, s.totalStandardDrinks ?? 0), 0);
          const uniqueDrinks = new Set(summary.flatMap((s) => (s.drinks ?? []).map((d) => d.name)));

          recordCandidates.push(
            { type: 'highest_weekly_std_drinks', userId: member.userId, value: totalStd, formatted: `${Math.round(totalStd * 10) / 10} standards` },
            { type: 'most_weekly_sessions', userId: member.userId, value: memberPosts.length, formatted: `${memberPosts.length} sessions` },
            { type: 'longest_single_session', userId: member.userId, value: longestSession, formatted: formatDuration(longestSession) },
            { type: 'highest_single_session_std_drinks', userId: member.userId, value: maxSessionStd, formatted: `${Math.round(maxSessionStd * 10) / 10} standards` },
            { type: 'most_weekly_unique_drinks', userId: member.userId, value: uniqueDrinks.size, formatted: `${uniqueDrinks.size} unique drinks` },
          );
        }

        const currentRecords = get().records.filter((r) => r.groupId === groupId);
        for (const candidate of recordCandidates) {
          const existing = currentRecords.find((r) => r.recordType === candidate.type);
          if (!existing || candidate.value > existing.value) {
            await supabase
              .from('group_records')
              .upsert(
                {
                  group_id: groupId,
                  record_type: candidate.type,
                  user_id: candidate.userId,
                  value: candidate.value,
                  formatted_value: candidate.formatted,
                  week_key: weekKey,
                  achieved_at: new Date().toISOString(),
                },
                { onConflict: 'group_id,record_type' }
              );
          }
        }

        await get().fetchRecords(groupId);
      },

      refreshRecap: async (groupId, weekKey, members) => {
        const existing = get().recaps.find((r) => r.groupId === groupId && r.weekKey === weekKey);
        if (!existing) return;

        const { start, end } = getWeekBounds(weekKey);
        const memberIds = members.map((m) => m.userId);

        const { data: posts } = await supabase
          .from('feed_items')
          .select('id, user_id, session_summary, created_at')
          .in('user_id', memberIds)
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString());

        const totalSessions = (posts ?? []).length;

        // If the post count matches, the recap is still current
        if (totalSessions === existing.summary.totalGroupSessions) return;

        // Recompute from fresh data
        const memberData: MemberWeekData[] = members.map((m) => ({
          userId: m.userId,
          userName: m.userName,
          userAvatar: m.userAvatar,
          posts: (posts ?? [])
            .filter((p) => (p.user_id as string) === m.userId)
            .map((p) => ({
              id: p.id as string,
              userId: p.user_id as string,
              userName: m.userName,
              userAvatar: m.userAvatar,
              sessionId: '',
              sessionSummary: p.session_summary as FeedItem['sessionSummary'],
              photos: [],
              caption: '',
              likes: [],
              comments: [],
              createdAt: p.created_at as string,
            })),
        }));

        const { awards, summary } = computeWeeklyAwards(memberData, weekKey);

        // Preserve week-over-week from original
        summary.weekOverWeekChange = existing.summary.weekOverWeekChange;

        // Update local state only (DB recap stays as-is)
        const refreshed: RoastRecap = {
          ...existing,
          awards: awards.map((a) => ({ ...a, id: crypto.randomUUID(), recapId: existing.id })),
          summary,
        };

        set((state) => ({
          recaps: state.recaps.map((r) =>
            r.groupId === groupId && r.weekKey === weekKey ? refreshed : r
          ),
        }));
      },

      getRecapsByGroup: (groupId) =>
        get().recaps.filter((r) => r.groupId === groupId),

      getLatestRecap: (groupId) =>
        get()
          .recaps.filter((r) => r.groupId === groupId)
          .sort((a, b) => b.weekKey.localeCompare(a.weekKey))[0],

      getCurrentWeekKey: () => getWeekKey(new Date()),

      getLastWeekKey: () => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return getWeekKey(d);
      },

      hasRecapForWeek: (groupId, weekKey) =>
        get().recaps.some((r) => r.groupId === groupId && r.weekKey === weekKey),
    }),
    {
      name: 'hd-roasts',
      storage: safeJSONStorage(),
      partialize: (s) => ({
        recaps: s.recaps.slice(0, 50),
        streaks: s.streaks,
        records: s.records,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.loading = false;
      },
    }
  )
);
