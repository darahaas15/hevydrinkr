import type { FeedItem } from '@/types';

const MILESTONES: Record<number, { label: string }> = {
  10: { label: '10th Sesh' },
  25: { label: '25th Sesh' },
  50: { label: '50th Sesh' },
  100: { label: '100th Sesh' },
};

/**
 * Given a feed item and the full items list, return a milestone badge
 * if this post is the user's 10th, 25th, 50th, or 100th session post.
 * Returns null if no milestone applies.
 */
export function getMilestoneBadge(
  item: FeedItem,
  allItems: FeedItem[]
): { label: string } | null {
  const userItems = allItems
    .filter((i) => i.userId === item.userId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  const position = userItems.findIndex((i) => i.id === item.id) + 1; // 1-indexed
  return MILESTONES[position] ?? null;
}
