import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
} from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_700Bold } from '@expo-google-fonts/geist-mono';
import { useAuthStore } from '@/stores/use-auth-store';
import { Celebration } from '~/components/celebration';
import { ToastHost } from '~/components/toast-host';
import { useAppShell } from '~/lib/use-app-shell';
import { useTheme } from '~/theme';
import { navigationTheme } from '~/theme/navigation';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useTheme();
  const { scheme, colors } = theme;
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    GeistMono_400Regular,
    GeistMono_700Bold,
  });
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Native chrome (navigation and tab bars, sheets, alerts, the keyboard)
  // follows the in-app Light/Dark choice rather than the phone's setting.
  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(scheme);
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [scheme, colors.background]);

  useAppShell();

  // A returning user is signed in from persisted state on the first frame;
  // only a fresh install waits for the session check.
  const ready = fontsLoaded && (isAuthenticated || !isLoading);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme(theme)}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={isAuthenticated}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="drink-picker"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [1],
                sheetGrabberVisible: true,
                contentStyle: { backgroundColor: colors.sheetSolidBg },
              }}
            />
            <Stack.Screen
              name="end-session"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: 'fitToContents',
                sheetGrabberVisible: true,
                contentStyle: { backgroundColor: colors.sheetSolidBg },
              }}
            />
            <Stack.Screen name="session-summary" options={{ presentation: 'modal' }} />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="sign-in" options={{ contentStyle: { backgroundColor: colors.backgroundDeep } }} />
          </Stack.Protected>
        </Stack>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
        <Celebration />
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
