import type { FeedItem, UserProfile } from '@/types';
import { supabase } from '@/lib/supabase/client';

/** Feed logic shared by the web feed page and the iOS feed screen. */

export type FeedTab = 'home' | 'discover';

interface FeedAudience {
  followingIds: string[];
  blockedUserIds: string[];
  currentUserId: string | undefined;
}

/**
 * Home is you plus the people you follow; Discover is everyone else. Blocked
 * users never show. Newest first.
 */
export function feedForTab(items: FeedItem[], tab: FeedTab, audience: FeedAudience): FeedItem[] {
  const followSet = new Set(audience.followingIds);
  const blockedSet = new Set(audience.blockedUserIds);
  const uid = audience.currentUserId;
  const filtered = tab === 'home'
    ? items.filter((item) => (followSet.has(item.userId) || item.userId === uid) && !blockedSet.has(item.userId))
    : items.filter((item) => !followSet.has(item.userId) && item.userId !== uid && !blockedSet.has(item.userId));
  return [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** People to suggest on Discover: not you, not followed, not blocked. */
export function discoverableUsers(users: UserProfile[], audience: FeedAudience): UserProfile[] {
  const followSet = new Set(audience.followingIds);
  const blockedSet = new Set(audience.blockedUserIds);
  return users.filter(
    (u) => u.id !== audience.currentUserId && !followSet.has(u.id) && !blockedSet.has(u.id),
  );
}

/**
 * Profiles whose username or display name contains the query, excluding the
 * searcher. Null when the request failed, so callers keep prior results.
 */
export async function searchProfiles(query: string, excludeUserId: string | undefined): Promise<UserProfile[] | null> {
  const q = query.trim().toLowerCase();
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, created_at, is_private')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq('id', excludeUserId ?? '')
    .limit(20);

  if (!data) return null;
  return data.map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
    bio: p.bio || '',
    // Body metrics are self-only; default for stranger view.
    gender: 'other',
    weightKg: 70,
    heightCm: null,
    joinedAt: p.created_at,
    isDemo: false,
    isPrivate: p.is_private || false,
    followers: [],
    following: [],
  }));
}

/** Other people's loaded posts matching the query by name, caption or venue. */
export function searchFeedPosts(items: FeedItem[], query: string, currentUserId: string | undefined): FeedItem[] {
  const q = query.trim().toLowerCase();
  return items.filter(
    (item) =>
      item.userId !== currentUserId &&
      (item.userName.toLowerCase().includes(q) ||
        item.caption.toLowerCase().includes(q) ||
        item.sessionSummary.venue.toLowerCase().includes(q)),
  );
}

/**
 * Whether the viewer liked a post, and the like row to delete when unliking.
 * Prefers the populated likes array; falls back to `currentUserLikeId` during
 * the cache-only window (likes: [] but counts present), whose presence means
 * "current user liked this" because it was derived against their id.
 */
export function likeStateFor(item: FeedItem, userId: string | undefined): { isLiked: boolean; likeId: string | null } {
  const userLike = item.likes.find((l) => l.userId === userId);
  const isLiked = userLike != null || (item.likes.length === 0 && item.currentUserLikeId != null);
  return { isLiked, likeId: userLike?.id ?? item.currentUserLikeId ?? null };
}

export function feedPostPath(feedItemId: string): string {
  return `/feed/${feedItemId}`;
}

export function feedShareText(item: FeedItem): string {
  return `${item.userName} had ${item.sessionSummary.totalDrinks} drinks at ${item.sessionSummary.venue}`;
}
