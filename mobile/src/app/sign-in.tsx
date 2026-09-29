import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import { CheckCircle, ChevronLeft, Lock, Mail } from 'lucide-react-native';
import { useAuthStore } from '@/stores/use-auth-store';
import { supabase } from '@/lib/supabase/client';
import { getBaseUrl } from '@/lib/share';
import { AmbientGlow } from '~/components/ambient-glow';
import { Button } from '~/components/button';
import { Logo } from '~/components/logo';
import { Text } from '~/components/text';
import { TextField } from '~/components/text-field';
import { Wordmark } from '~/components/wordmark';
import { useTheme } from '~/theme';

type Screen = 'landing' | 'login' | 'reset';

/** Landing, sign in and password reset (the web's `/` and `/forgot-password`). */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>('landing');
  const [email, setEmail] = useState('');

  return (
    <View style={styles.root}>
      <AmbientGlow />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {screen === 'landing' && <Landing onSignIn={() => setScreen('login')} />}
          {screen === 'login' && (
            <Login email={email} onEmailChange={setEmail} onBack={() => setScreen('landing')} onForgot={() => setScreen('reset')} />
          )}
          {screen === 'reset' && <ResetPassword email={email} onEmailChange={setEmail} onBack={() => setScreen('login')} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Landing({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.column, styles.landing]}>
      <View style={styles.landingTop} />
      <Animated.View entering={FadeInDown.duration(500)} style={{ marginBottom: 32 }}>
        <Logo size={56} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={{ marginBottom: 12 }}>
        <Wordmark size={42} />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(200)}>
        <Text size={15} tone="fgSecondary" align="center" leading={1.625} style={{ marginBottom: 48 }}>
          Track sessions. Compete with friends.{'\n'}Own the night.
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(350)} style={{ alignSelf: 'stretch' }}>
        <Button label="Sign In" variant="gradient" size="lg" onPress={onSignIn} />
      </Animated.View>
      <View style={styles.landingBottom} />
      <Text size={10} tone="fgFaint" align="center" leading={1.625} style={{ maxWidth: 280 }}>
        For adults 18+ only. Drink responsibly. If you need help, contact SAMHSA at 1-800-662-4357.
      </Text>
    </Animated.View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.back} accessibilityRole="button">
      <ChevronLeft size={16} color={colors.fgSecondary} />
      <Text size={14} tone="fgSecondary">
        Back
      </Text>
    </Pressable>
  );
}

function Login({
  email,
  onEmailChange,
  onBack,
  onForgot,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  onBack: () => void;
  onForgot: () => void;
}) {
  const login = useAuthStore((s) => s.login);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    setError('');
    const err = await login(email.trim(), password);
    setSubmitting(false);
    // On success the auth store flips isAuthenticated and the root layout
    // swaps this screen for the app.
    if (err) setError(err);
  };

  return (
    <Animated.View entering={SlideInRight.duration(200)} style={styles.column}>
      <BackButton onPress={onBack} />
      <Text size={26} weight="extrabold" tracking={-0.65} leading={1.25} style={{ marginBottom: 4 }}>
        Welcome Back
      </Text>
      <Text size={14} tone="fgSecondary" style={{ marginBottom: 32 }}>
        Sign in to your account
      </Text>
      <View style={{ gap: 12, marginBottom: 8 }}>
        <TextField
          icon={(color) => <Mail size={16} color={color} />}
          value={email}
          onChangeText={onEmailChange}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
        />
        <TextField
          ref={passwordRef}
          icon={(color) => <Lock size={16} color={color} />}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>
      <Pressable accessibilityRole="button" onPress={onForgot} hitSlop={8} style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
        <Text size={12} tone="fgSecondary">
          Forgot password?
        </Text>
      </Pressable>
      {error ? <ErrorText message={error} /> : null}
      <View style={{ paddingTop: 24 }}>
        <Button label="Sign In" variant="gradient" size="lg" loading={submitting} onPress={submit} />
      </View>
    </Animated.View>
  );
}

function ResetPassword({
  email,
  onEmailChange,
  onBack,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    setSubmitting(true);
    setError('');
    // The link opens the web app's reset page, which finishes the reset.
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${getBaseUrl()}/reset-password`,
    });
    setSubmitting(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  if (sent) {
    return (
      <Animated.View entering={FadeInDown} style={[styles.column, { alignItems: 'center', marginTop: 48 }]}>
        <CheckCircle size={48} color={colors.accent} style={{ marginBottom: 16 }} />
        <Text size={22} weight="extrabold" tracking={-0.55} style={{ marginBottom: 8 }}>
          Check your email
        </Text>
        <Text size={14} tone="fgSecondary" align="center" leading={1.625} style={{ marginBottom: 32 }}>
          We sent a password reset link to{'\n'}
          <Text size={14} tone="fgStrong">
            {email.trim()}
          </Text>
        </Text>
        <Text size={12} tone="muted" style={{ marginBottom: 32 }}>
          Didn&apos;t get it? Check your spam folder.
        </Text>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8}>
          <Text size={14} tone="accent">
            Back to Sign In
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={SlideInRight.duration(200)} style={styles.column}>
      <BackButton onPress={onBack} />
      <Text size={26} weight="extrabold" tracking={-0.65} leading={1.25} style={{ marginBottom: 4 }}>
        Reset Password
      </Text>
      <Text size={14} tone="fgSecondary" style={{ marginBottom: 32 }}>
        Enter your email and we&apos;ll send you a reset link
      </Text>
      <View style={{ marginBottom: 16 }}>
        <TextField
          icon={(color) => <Mail size={16} color={color} />}
          value={email}
          onChangeText={onEmailChange}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="send"
          onSubmitEditing={submit}
        />
      </View>
      {error ? <ErrorText message={error} /> : null}
      <View style={{ paddingTop: 8 }}>
        <Button label="Send Reset Link" variant="gradient" size="lg" loading={submitting} onPress={submit} />
      </View>
    </Animated.View>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(150)}>
      <Text size={14} tone="dangerFg" style={{ marginBottom: 16, paddingHorizontal: 4 }} accessibilityRole="alert">
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', maxWidth: 384, paddingHorizontal: 24, flexGrow: 1 },
  landing: { alignItems: 'center', paddingHorizontal: 32 },
  landingTop: { flexGrow: 1, minHeight: '18%' },
  landingBottom: { flexGrow: 1, minHeight: '10%' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 20, marginLeft: -4 },
});
