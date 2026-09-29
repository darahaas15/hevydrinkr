import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import type { SessionMood } from '@/types';
import { useSessionStore } from '@/stores/use-session-store';
import { useDrinkPrefsStore } from '@/stores/use-drink-prefs-store';
import { useTimer } from '@/hooks/use-timer';
import { SESSION_MOODS } from '@/lib/constants';
import { formatCost, sumCosts } from '@/lib/money';
import { finishActiveSession } from '@/lib/session-actions';
import { hapticLight } from '@/lib/haptics';
import { Button } from '~/components/button';
import { DrinkIcon } from '~/components/drink-icon';
import { Text } from '~/components/text';
import { fonts, useTheme } from '~/theme';

/** End the live session: mood, caption, then post or keep it private. */
export default function EndSessionSheet() {
  const { colors } = useTheme();
  const activeSession = useSessionStore((s) => s.activeSession);
  const currency = useDrinkPrefsStore((s) => s.currency);
  const timer = useTimer(activeSession?.startedAt ?? null);
  const [mood, setMood] = useState<SessionMood>('good');
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [captionFocused, setCaptionFocused] = useState(false);

  if (!activeSession) return null;
  const drinks = activeSession.drinks;
  const spend = sumCosts(drinks);

  const finish = (share: boolean) => {
    if (posting) return;
    setPosting(true);
    const completed = finishActiveSession({ mood, share, caption, taggedUserIds: [] });
    if (!completed) {
      setPosting(false);
      return;
    }
    router.dismiss();
    router.push({ pathname: '/session-summary', params: { id: completed.id } });
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={18} weight="bold">
            End Session
          </Text>
          <View style={styles.meta}>
            <MapPin size={12} color={colors.fgSecondary} />
            <Text size={11} tone="fgSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {activeSession.venue} · {drinks.length} drinks · {timer.formatted}
              {spend !== null ? ` · ${formatCost(spend, currency)}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.icons}>
          {drinks.slice(0, 6).map((d) => (
            <DrinkIcon key={d.id} category={d.category} size={16} />
          ))}
          {drinks.length > 6 && (
            <Text size={10} tone="muted">
              +{drinks.length - 6}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.moods} accessibilityRole="radiogroup">
        {SESSION_MOODS.map((m) => {
          const selected = mood === m.value;
          return (
            <Pressable
              key={m.value}
              onPress={() => {
                hapticLight();
                setMood(m.value);
              }}
              accessibilityRole="radio"
              accessibilityLabel={m.label}
              accessibilityState={{ selected }}
              style={[
                styles.mood,
                selected && {
                  backgroundColor: 'rgba(20, 184, 166, 0.1)',
                  borderColor: 'rgba(20, 184, 166, 0.3)',
                  transform: [{ scale: 1.1 }],
                },
              ]}
            >
              <Text size={20} leading={1.4}>
                {m.emoji}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Add a caption (optional)"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        multiline
        onFocus={() => setCaptionFocused(true)}
        onBlur={() => setCaptionFocused(false)}
        style={[
          styles.caption,
          {
            color: colors.foreground,
            backgroundColor: colors.surfaceSecondary,
            borderColor: captionFocused ? 'rgba(20, 184, 166, 0.4)' : colors.cardBorder,
          },
        ]}
      />

      <View style={{ gap: 10 }}>
        <View style={styles.buttons}>
          <Button label="Back" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button label="Post" onPress={() => finish(true)} disabled={posting} disabledOpacity={0.5} style={{ flex: 1 }} />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => finish(false)}
          disabled={posting}
          style={({ pressed }) => [styles.private, pressed && { backgroundColor: colors.surfaceSubtle }, posting && { opacity: 0.5 }]}
        >
          <Text size={13} weight="medium" tone="mutedForeground">
            Save without posting
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: 24, paddingTop: 28, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 2, maxWidth: 80 },
  moods: { flexDirection: 'row', justifyContent: 'space-between' },
  mood: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  caption: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  buttons: { flexDirection: 'row', gap: 12 },
  private: { alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
});
