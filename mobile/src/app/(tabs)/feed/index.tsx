import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useScrollToTop } from 'expo-router';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { Lock, Search } from 'lucide-react-native';
import type { FeedItem, UserProfile } from '@/types';
import { useAuthStore } from '@/stores/use-auth-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useModerationStore } from '@/stores/use-moderation-store';
import { useFollowState } from '@/hooks/use-follow-state';
import { getMilestoneBadge } from '@/lib/milestones';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { feedForTab, searchFeedPosts, searchProfiles, type FeedTab } from '@/lib/feed-utils';
import { Avatar } from '~/components/avatar';
import { Button } from '~/components/button';
import { DrinkIcon } from '~/components/drink-icon';
import { ErrorBanner } from '~/components/error-banner';
import { PressableScale } from '~/components/pressable-scale';
import { Skeleton } from '~/components/skeleton';
import { Text } from '~/components/text';
import { TextField } from '~/components/text-field';
import { FeedCard } from '~/features/feed/feed-card';
import { fonts, useTheme } from '~/theme';

const TABS: FeedTab[] = ['home', 'discover'];
const EMPTY: string[] = [];

export default function FeedScreen() {
  const { colors, scheme } = useTheme();
  const currentUser = useAuthStore((s) => s.currentUser);
  const followingIds = useAuthStore((s) => s.currentUser?.following ?? EMPTY);
  const fetchAllUsers = useAuthStore((s) => s.fetchAllUsers);
  const blockedUserIds = useModerationStore((s) => s.blockedUserIds);
  const items = useFeedStore((s) => s.items);
  const loading = useFeedStore((s) => s.loading);
  const loadingMore = useFeedStore((s) => s.loadingMore);
  const hasMore = useFeedStore((s) => s.hasMore);
  const feedError = useFeedStore((s) => s.error);
  const fetchFeed = useFeedStore((s) => s.fetchFeed);
  const fetchMoreFeed = useFeedStore((s) => s.fetchMoreFeed);

  const [tab, setTab] = useState<FeedTab>('home');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchFeedResults, setSearchFeedResults] = useState<FeedItem[]>([]);
  const [searching, setSearching] = useState(false);

  const listRef = useRef<FlatList<FeedItem>>(null);
  useScrollToTop(listRef);

  useEffect(() => {
    fetchFeed();
    fetchAllUsers();
  }, [fetchFeed, fetchAllUsers]);

  // Debounced people + post search on Discover, as on the web.
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!searchQuery.trim() || tab !== 'discover') {
        setSearchResults([]);
        setSearchFeedResults([]);
        return;
      }
      setSearching(true);
      const profiles = await searchProfiles(searchQuery, currentUser?.id);
      if (profiles) setSearchResults(profiles);
      setSearchFeedResults(searchFeedPosts(items, searchQuery, currentUser?.id));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, tab, currentUser?.id, items]);

  const sorted = useMemo(
    () => feedForTab(items, tab, { followingIds, blockedUserIds, currentUserId: currentUser?.id }),
    [items, tab, followingIds, blockedUserIds, currentUser?.id],
  );
  const showSearchResults = tab === 'discover' && searchQuery.trim().length > 0;

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFeed(true), fetchAllUsers(true)]);
    setRefreshing(false);
  };

  const selectTab = (next: FeedTab) => {
    hapticSelection();
    setTab(next);
    if (next === 'home') setSearchQuery('');
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { borderBottomColor: colors.chromeBorder, backgroundColor: colors.background }]}>
        <SegmentedControl
          values={['Home', 'Discover']}
          selectedIndex={TABS.indexOf(tab)}
          onChange={(e) => selectTab(TABS[e.nativeEvent.selectedSegmentIndex])}
          appearance={scheme}
          fontStyle={{ fontFamily: fonts.medium, fontSize: 13, color: colors.mutedForeground }}
          activeFontStyle={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.foreground }}
        />
        {tab === 'discover' && (
          <TextField
            icon={(color) => <Search size={16} color={color} />}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search people & posts..."
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            containerStyle={{ marginTop: 12, backgroundColor: colors.surfaceSecondary }}
          />
        )}
      </View>

      {showSearchResults ? (
        <SearchResults searching={searching} people={searchResults} posts={searchFeedResults} />
      ) : (
        <FlatList
          ref={listRef}
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <FeedCard item={item} milestone={getMilestoneBadge(item, items)} showFollowButton={tab === 'discover'} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (hasMore && !loadingMore && sorted.length > 0) fetchMoreFeed();
          }}
          ListHeaderComponent={
            <>
              {feedError ? <ErrorBanner message={feedError} onRetry={() => fetchFeed(true)} /> : null}
              {tab === 'discover' && sorted.length > 0 && (
                <Text size={12} weight="semibold" tone="fgSecondary" uppercase tracking={0.6} style={styles.sectionLabel}>
                  Discover Posts
                </Text>
              )}
            </>
          }
          ListEmptyComponent={loading ? <FeedSkeleton /> : <EmptyFeed tab={tab} />}
          ListFooterComponent={
            sorted.length === 0 ? null : loadingMore ? (
              <ActivityIndicator color={colors.accent} style={styles.footer} />
            ) : !hasMore ? (
              <Text size={12} tone="fgFaint" align="center" style={styles.footer}>
                You&apos;re all caught up
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

function Separator() {
  return <View style={{ height: 12 }} />;
}

function EmptyFeed({ tab }: { tab: FeedTab }) {
  return (
    <View style={styles.empty}>
      <DrinkIcon category="beer" size={40} />
      <Text size={16} weight="semibold" tone="mutedForeground" style={{ marginTop: 16, marginBottom: 4 }}>
        {tab === 'home' ? 'No posts yet' : 'Nothing to discover'}
      </Text>
      <Text size={14} tone="muted" align="center" style={{ maxWidth: 240, marginBottom: 16 }}>
        {tab === 'home' ? 'Start a session to see your first post' : 'No new posts to discover'}
      </Text>
      {tab === 'home' && (
        <Button label="Start Your First Sesh" onPress={() => router.navigate('/session')} style={{ paddingHorizontal: 20 }} />
      )}
    </View>
  );
}

function FeedSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
          <View style={styles.skeletonHeader}>
            <Skeleton width={40} height={40} radius={20} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width={112} height={14} />
              <Skeleton width={64} height={10} />
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
            <Skeleton width="100%" height={12} />
            <Skeleton width="75%" height={12} />
          </View>
          <View style={[styles.skeletonStats, { backgroundColor: colors.surfaceFaint }]}>
            <Skeleton width={96} height={10} />
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {Array.from({ length: 5 }).map((__, j) => (
                <Skeleton key={j} width={24} height={24} />
              ))}
            </View>
            <Skeleton width={160} height={10} />
          </View>
          <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 12 }}>
            <Skeleton width={40} height={16} />
            <Skeleton width={40} height={16} />
            <Skeleton width={40} height={16} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SearchResults({ searching, people, posts }: { searching: boolean; people: UserProfile[]; posts: FeedItem[] }) {
  return (
    <ScrollView contentContainerStyle={styles.search} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      {searching && (
        <Text size={14} tone="muted" align="center" style={{ paddingVertical: 16 }}>
          Searching...
        </Text>
      )}
      {!searching && people.length === 0 && posts.length === 0 && (
        <Text size={14} tone="muted" align="center" style={{ paddingVertical: 32 }}>
          No results found
        </Text>
      )}
      {!searching && people.length > 0 && (
        <>
          <Text size={12} weight="semibold" tone="fgSecondary" uppercase tracking={0.6} style={{ marginBottom: 8 }}>
            People
          </Text>
          <View style={{ gap: 6 }}>
            {people.map((user) => (
              <PersonRow key={user.id} user={user} />
            ))}
          </View>
        </>
      )}
      {!searching && posts.length > 0 && (
        <>
          <Text size={12} weight="semibold" tone="fgSecondary" uppercase tracking={0.6} style={{ marginTop: 16, marginBottom: 8 }}>
            Posts
          </Text>
          <View style={{ gap: 12 }}>
            {posts.slice(0, 10).map((item) => (
              <FeedCard key={item.id} item={item} showFollowButton />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function PersonRow({ user }: { user: UserProfile }) {
  const { colors } = useTheme();
  const { state, label, onClick } = useFollowState(user.id);
  if (state === 'self') return null;
  const accent = state === 'none';
  return (
    <View style={[styles.person, { backgroundColor: colors.surfaceFaint, borderColor: colors.borderFaint }]}>
      <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="semibold" numberOfLines={1}>
          {user.displayName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text size={11} tone="fgSecondary">
            @{user.username}
          </Text>
          {user.isPrivate && <Lock size={12} color={colors.muted} />}
        </View>
      </View>
      <PressableScale
        scaleTo={0.95}
        onPress={() => {
          hapticLight();
          onClick();
        }}
        style={[
          styles.followButton,
          accent
            ? { backgroundColor: colors.accent }
            : { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong },
        ]}
        accessibilityRole="button"
      >
        <Text size={12} weight="semibold" tone={accent ? 'accentForeground' : 'mutedForeground'}>
          {label}
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  sectionLabel: { marginBottom: 12 },
  footer: { paddingVertical: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  skeletonCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  skeletonStats: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 12, gap: 8 },
  search: { paddingHorizontal: 16, paddingVertical: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  followButton: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
});
