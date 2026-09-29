import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useVenueStats } from '@/hooks/use-venue-stats';
import { canonicalizeVenue } from '@/lib/venues';
import { hapticHeavy } from '@/lib/haptics';
import { Button } from '~/components/button';
import { DrinkIcon } from '~/components/drink-icon';
import { Skeleton } from '~/components/skeleton';
import { Text } from '~/components/text';
import { VenueInput } from '~/features/session/venue-input';
import { useTheme } from '~/theme';

const EMPTY_SESSIONS: never[] = [];

/** "Start a Sesh" with your recent sessions (the web's session start screen). */
export function StartSession({ loadingHistory }: { loadingHistory: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.currentUser);
  const startSession = useSessionStore((s) => s.startSession);
  const mySessions = useSessionStore((s) => (currentUser ? s.sessionsByUser[currentUser.id] : undefined) ?? EMPTY_SESSIONS);
  const venueStats = useVenueStats();
  const [venue, setVenue] = useState('');

  const start = () => {
    if (!venue.trim() || !currentUser) return;
    hapticHeavy();
    // Snap onto an existing spelling so "toit" doesn't fork from "Toit".
    startSession(canonicalizeVenue(venue, venueStats), currentUser.id);
    setVenue('');
  };

  const recent = mySessions.slice(0, 5);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Animated.View entering={FadeIn.duration(250)} style={styles.hero}>
          <DrinkIcon category="beer" size={48} />
          <Text size={24} weight="extrabold" tracking={-0.6} style={{ marginTop: 20, marginBottom: 4 }}>
            Start a Sesh
          </Text>
          <Text size={14} tone="fgSecondary" style={{ marginBottom: 32 }}>
            Log drinks, track your score, beat PRs
          </Text>

          <View style={styles.form}>
            <VenueInput value={venue} onChange={setVenue} venues={venueStats} onSubmit={start} />
            <Button label="Start Drinking" size="lg" textSize={16} disabledOpacity={0.2} onPress={start} disabled={!venue.trim()} />
          </View>

          {loadingHistory && recent.length === 0 ? (
            <View style={styles.recent}>
              <Skeleton width={64} height={12} style={{ marginBottom: 12 }} />
              <View style={{ gap: 6 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <View key={i} style={[styles.row, { backgroundColor: colors.surfaceFaint, borderColor: colors.borderFaint }]}>
                    <Skeleton width={20} height={20} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Skeleton width={112} height={14} />
                      <Skeleton width={80} height={10} />
                    </View>
                    <Skeleton width={48} height={10} />
                  </View>
                ))}
              </View>
            </View>
          ) : (
            recent.length > 0 && (
              <View style={styles.recent}>
                <Text size={12} weight="semibold" tone="fgSecondary" uppercase tracking={0.6} style={{ marginBottom: 12 }}>
                  Recent
                </Text>
                <View style={{ gap: 6 }}>
                  {recent.map((session) => (
                    <View key={session.id} style={[styles.row, { backgroundColor: colors.surfaceFaint, borderColor: colors.borderFaint }]}>
                      <DrinkIcon category={session.drinks[0]?.category ?? 'beer'} size={20} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text size={14} weight="medium" numberOfLines={1}>
                          {session.venue}
                        </Text>
                        <Text size={11} tone="muted">
                          {session.drinks.length} drink{session.drinks.length !== 1 ? 's' : ''} · {Math.floor(session.durationMinutes / 60)}h{' '}
                          {session.durationMinutes % 60}m
                        </Text>
                      </View>
                      <Text size={11} tone="fgFaint">
                        {new Date(session.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          )}
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  hero: { alignItems: 'center' },
  form: { width: '100%', maxWidth: 384, gap: 12 },
  recent: { width: '100%', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
});
