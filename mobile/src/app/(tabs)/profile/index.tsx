import { ScrollView, StyleSheet, View } from 'react-native';
import { LogOut, Moon, Sun } from 'lucide-react-native';
import { useAuthStore } from '@/stores/use-auth-store';
import { hapticSelection } from '@/lib/haptics';
import { Avatar } from '~/components/avatar';
import { PressableScale } from '~/components/pressable-scale';
import { Text } from '~/components/text';
import { useThemeStore, type ThemePreference } from '~/theme/theme-store';
import { useTheme } from '~/theme';

const THEMES: [ThemePreference, string, typeof Sun][] = [
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
];

/** Your profile and the settings ported so far: appearance and sign out. */
export default function ProfileScreen() {
  const { colors } = useTheme();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  if (!currentUser) return null;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size="xl" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={20} weight="bold" numberOfLines={1}>
            {currentUser.displayName}
          </Text>
          <Text size={13} tone="fgSecondary">
            @{currentUser.username}
          </Text>
          <View style={styles.counts}>
            <Text size={13} tone="mutedForeground">
              <Text size={13} weight="bold">
                {currentUser.followers.length}
              </Text>{' '}
              followers
            </Text>
            <Text size={13} tone="mutedForeground">
              <Text size={13} weight="bold">
                {currentUser.following.length}
              </Text>{' '}
              following
            </Text>
          </View>
        </View>
      </View>
      {!!currentUser.bio && (
        <Text size={13} tone="fgStrong" style={{ marginTop: -8 }}>
          {currentUser.bio}
        </Text>
      )}

      <View>
        <Text size={10} weight="semibold" tone="muted" uppercase tracking={0.5} style={{ marginBottom: 10 }}>
          Appearance
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardTitle}>
            <Sun size={16} color={colors.fgSecondary} />
            <Text size={14}>Theme</Text>
          </View>
          <View style={styles.themes}>
            {THEMES.map(([value, label, Icon]) => {
              const active = preference === value;
              return (
                <PressableScale
                  key={value}
                  onPress={() => {
                    if (active) return;
                    hapticSelection();
                    setPreference(value);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.theme,
                    active
                      ? { backgroundColor: colors.accentMuted, borderColor: 'rgba(20, 184, 166, 0.4)' }
                      : { backgroundColor: colors.cardHover, borderColor: colors.cardBorder },
                  ]}
                >
                  <Icon size={16} color={active ? colors.accentText : colors.mutedForeground} />
                  <Text size={12} weight="medium" tone={active ? 'accentText' : 'mutedForeground'}>
                    {label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>
      </View>

      <PressableScale
        scaleTo={0.98}
        onPress={() => logout()}
        accessibilityRole="button"
        style={[styles.signOut, { backgroundColor: colors.card, borderColor: colors.hairline }]}
      >
        <LogOut size={16} color={colors.mutedForeground} />
        <Text size={14} tone="mutedForeground">
          Sign Out
        </Text>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 24 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counts: { flexDirection: 'row', gap: 16, marginTop: 6 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  themes: { flexDirection: 'row', gap: 8 },
  theme: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
});
