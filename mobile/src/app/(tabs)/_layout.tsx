import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useSessionStore } from '@/stores/use-session-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { LiveSessionAccessory } from '~/features/session/live-session-accessory';
import { fonts, useTheme } from '~/theme';

/**
 * The system tab bar. Feed, Sesh and Profile are ported so far; Groups and
 * the leaderboard join as their screens land.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const userId = useAuthStore((s) => s.currentUser?.id);
  const hasOwnLiveSession = useSessionStore((s) => !!s.activeSession && s.activeSession.userId === userId);
  // Like the web banner: on every tab except the session itself.
  const showLiveSession = hasOwnLiveSession && !pathname.startsWith('/session');

  return (
    <NativeTabs
      tintColor={colors.accent}
      labelStyle={{ fontFamily: fonts.medium }}
      minimizeBehavior="onScrollDown"
    >
      {showLiveSession && (
        <NativeTabs.BottomAccessory>
          <LiveSessionAccessory />
        </NativeTabs.BottomAccessory>
      )}
      <NativeTabs.Trigger name="feed">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>Feed</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="session">
        <NativeTabs.Trigger.Icon sf={{ default: 'wineglass', selected: 'wineglass.fill' }} />
        <NativeTabs.Trigger.Label>Sesh</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
