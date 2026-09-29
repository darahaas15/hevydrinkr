// Web-preview stand-in (`npm run web`) for the native tab bar, which has no
// browser equivalent: a bottom tab bar with the same tabs, so screens can be
// checked in a browser at phone size. The iOS app uses _layout.tsx.
import { Tabs } from 'expo-router';
import { House, User, Wine } from 'lucide-react-native';
import { fonts, useTheme } from '~/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.fgSecondary,
        tabBarLabelStyle: { fontFamily: fonts.medium },
        tabBarStyle: { backgroundColor: colors.chromeBg, borderTopColor: colors.chromeBorder },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: ({ color }) => <House size={22} color={color} /> }} />
      <Tabs.Screen name="session" options={{ title: 'Sesh', tabBarIcon: ({ color }) => <Wine size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <User size={22} color={color} /> }} />
    </Tabs>
  );
}
