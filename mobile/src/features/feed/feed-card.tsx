import { memo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Clock, Heart, MessageCircle, Share2, Tag, UserPlus, Wine } from 'lucide-react-native';
import type { FeedItem, UserProfile } from '@/types';
import { useAuthStore } from '@/stores/use-auth-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useUIStore } from '@/stores/use-ui-store';
import { hapticLight } from '@/lib/haptics';
import { getBaseUrl, shareLink } from '@/lib/share';
import { feedPostPath, feedShareText, likeStateFor } from '@/lib/feed-utils';
import { formatDuration, formatTimeAgo } from '@/lib/utils';
import { Avatar } from '~/components/avatar';
import { DrinkIcon } from '~/components/drink-icon';
import { PressableScale } from '~/components/pressable-scale';
import { Skeleton } from '~/components/skeleton';
import { Text } from '~/components/text';
import { useTheme } from '~/theme';

const MAX_ICONS = 15;

/** A session post (src/components/feed/feed-card.tsx). */
export const FeedCard = memo(function FeedCard({
  item,
  milestone,
  showFollowButton,
}: {
  item: FeedItem;
  milestone?: { label: string } | null;
  showFollowButton?: boolean;
}) {
  const { colors } = useTheme();
  const currentUser = useAuthStore((s) => s.currentUser);
  const toggleFollow = useAuthStore((s) => s.toggleFollow);
  const getUserById = useAuthStore((s) => s.getUserById);
  const addLike = useFeedStore((s) => s.addLike);
  const removeLike = useFeedStore((s) => s.removeLike);
  const addToast = useUIStore((s) => s.addToast);
  const isFollowing = currentUser?.following.includes(item.userId) ?? false;
  const { isLiked, likeId } = likeStateFor(item, currentUser?.id);
  const s = item.sessionSummary;

  const handleLike = () => {
    if (!currentUser) return;
    hapticLight();
    if (isLiked) {
      if (likeId) removeLike(item.id, likeId);
    } else {
      addLike(item.id, {
        id: crypto.randomUUID(),
        userId: currentUser.id,
        userName: currentUser.displayName,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleShare = async () => {
    const text = feedShareText(item);
    const result = await shareLink(`${getBaseUrl()}${feedPostPath(item.id)}`, text, text);
    if (result === 'copied') addToast('Link copied!', 'success');
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
      {/* Header */}
      <View style={styles.header}>
        <Avatar name={item.userName} src={item.userAvatar} size="md" />
        <View style={styles.headerText}>
          <Text size={14} weight="semibold" numberOfLines={1}>
            {item.userName}
          </Text>
          <View style={styles.row6}>
            <Text size={11} tone="fgSecondary">
              {formatTimeAgo(item.createdAt)}
            </Text>
            {item.isBackfilled && (
              <View style={[styles.pill, { backgroundColor: colors.surfaceRaised }]}>
                <Text size={10} weight="medium" tone="mutedForeground" leading={1}>
                  Past session
                </Text>
              </View>
            )}
            {milestone && (
              <View style={[styles.pill, { backgroundColor: colors.accent }]}>
                <Text size={10} weight="semibold" tone="accentForeground" leading={1}>
                  {milestone.label}
                </Text>
              </View>
            )}
          </View>
        </View>
        {showFollowButton && !isFollowing && item.userId !== currentUser?.id && (
          <PressableScale
            scaleTo={0.95}
            onPress={() => {
              hapticLight();
              toggleFollow(item.userId);
            }}
            style={[styles.follow, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
          >
            <UserPlus size={14} color={colors.accentForeground} />
            <Text size={12} weight="semibold" tone="accentForeground">
              Follow
            </Text>
          </PressableScale>
        )}
      </View>

      {!!item.caption && (
        <Text size={13} tone="fgStrong" style={styles.caption}>
          {item.caption}
        </Text>
      )}

      <TaggedUsers taggedUserIds={item.taggedUserIds ?? []} />

      {item.photos.length > 0 && <Photos photos={item.photos} />}

      {/* Session stats */}
      <View style={[styles.stats, { backgroundColor: colors.card, borderColor: colors.borderFaint }]}>
        <Text size={11} tone="fgSecondary" style={{ marginBottom: 8 }}>
          {s.venue}
        </Text>
        {(s.drinks?.length ?? 0) > 0 ? (
          <DrinkIconRow categories={s.drinks.map((d) => d.category)} />
        ) : (
          s.drinkEmojis.length > 0 && <DrinkIconRow categories={s.drinkEmojis.map(() => 'custom')} />
        )}
        <View style={styles.statRow}>
          <View style={styles.row4}>
            <Wine size={12} color={colors.fgSecondary} />
            <Text size={11} tone="fgSecondary">
              {s.totalDrinks} drink{s.totalDrinks !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.row4}>
            <Clock size={12} color={colors.fgSecondary} />
            <Text size={11} tone="fgSecondary">
              {formatDuration(s.durationMinutes)}
            </Text>
          </View>
          <Text size={11} tone="fgSecondary">
            {s.totalStandardDrinks.toFixed(1)} std
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.actionRow}>
          <View style={styles.row4}>
            <PressableScale onPress={handleLike} scaleTo={1.15} hitSlop={8} accessibilityRole="button" accessibilityLabel={isLiked ? 'Unlike' : 'Like'}>
              <Heart size={18} color={isLiked ? '#ef4444' : colors.muted} fill={isLiked ? '#ef4444' : 'none'} />
            </PressableScale>
            {item.likeCount > 0 && (
              <Text size={11} color={isLiked ? '#ef4444' : colors.muted}>
                {item.likeCount}
              </Text>
            )}
          </View>
          <View style={styles.row6}>
            <MessageCircle size={18} color={colors.muted} />
            {item.commentCount > 0 && (
              <Text size={11} tone="muted">
                {item.commentCount}
              </Text>
            )}
          </View>
          <PressableScale onPress={handleShare} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share">
            <Share2 size={18} color={colors.muted} />
          </PressableScale>
        </View>

        {/* Liked by: skeleton while only the cached count is known. */}
        {item.likeCount > 0 && item.likes.length === 0 && (
          <View style={[styles.likedBy, styles.row8]} accessibilityElementsHidden>
            <View style={styles.row}>
              {Array.from({ length: Math.min(3, item.likeCount) }).map((_, i) => (
                <Skeleton key={i} width={16} height={16} radius={8} style={{ marginLeft: i === 0 ? 0 : -6 }} />
              ))}
            </View>
            <Skeleton width={128} height={12} />
          </View>
        )}
        {item.likes.length > 0 && (
          <View style={[styles.likedBy, styles.row8]}>
            <View style={styles.row}>
              {item.likes.slice(0, 3).map((like, i) => (
                <Avatar
                  key={like.id}
                  name={like.userName}
                  size="xs"
                  src={getUserById(like.userId)?.avatarUrl ?? null}
                  style={{ marginLeft: i === 0 ? 0 : -6, borderWidth: 1, borderColor: colors.background }}
                />
              ))}
            </View>
            <Text size={12} tone="mutedForeground" style={{ flexShrink: 1 }}>
              Liked by{' '}
              <Text size={12} weight="semibold" tone="fgBright">
                {item.likes[0].userId === currentUser?.id ? 'you' : item.likes[0].userName}
              </Text>
              {item.likes.length > 1 && (
                <>
                  {' and '}
                  <Text size={12} weight="semibold" tone="fgBright">
                    {item.likes.length - 1} other{item.likes.length - 1 !== 1 ? 's' : ''}
                  </Text>
                </>
              )}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

function DrinkIconRow({ categories }: { categories: string[] }) {
  return (
    <View style={styles.icons}>
      {categories.slice(0, MAX_ICONS).map((category, i) => (
        <DrinkIcon key={i} category={category} size={16} />
      ))}
      {categories.length > MAX_ICONS && (
        <Text size={11} tone="muted" style={{ marginLeft: 4 }}>
          +{categories.length - MAX_ICONS}
        </Text>
      )}
    </View>
  );
}

function TaggedUsers({ taggedUserIds }: { taggedUserIds: string[] }) {
  const { colors } = useTheme();
  const allUsers = useAuthStore((s) => s.allUsers);
  const users = taggedUserIds
    .map((id) => allUsers.find((u) => u.id === id))
    .filter((u): u is UserProfile => !!u);
  if (users.length === 0) return null;
  const shown = users.slice(0, 3);
  const extra = users.length - shown.length;
  return (
    <View style={[styles.tagged, styles.row4]}>
      <Tag size={12} color={colors.fgSecondary} />
      <Text size={12} tone="fgSecondary" style={{ flexShrink: 1 }}>
        with{' '}
        {shown.map((u, i) => (
          <Text key={u.id} size={12} weight="semibold" tone="accent">
            @{u.username}
            {i < shown.length - 1 ? ', ' : ''}
          </Text>
        ))}
        {extra > 0 ? ` +${extra} more` : ''}
      </Text>
    </View>
  );
}

function Photos({ photos }: { photos: string[] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const height = (width * 3) / 4;
  const photo = (uri: string, key: number) => (
    <Image
      key={key}
      source={uri}
      style={{ width, height, backgroundColor: colors.surfaceSubtle }}
      contentFit="cover"
      transition={150}
      recyclingKey={uri}
    />
  );
  return (
    <View style={{ marginBottom: 8 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 &&
        (photos.length === 1 ? (
          photo(photos[0], 0)
        ) : (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {photos.map(photo)}
          </ScrollView>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerText: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  row4: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  follow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  caption: { paddingHorizontal: 16, paddingBottom: 8 },
  tagged: { paddingHorizontal: 16, paddingBottom: 8 },
  stats: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2, marginBottom: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actions: { paddingHorizontal: 16, paddingBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  likedBy: { marginTop: 8 },
});
