import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MapPin } from 'lucide-react-native';
import { suggestVenues, type VenueStat } from '@/lib/venues';
import { hapticSelection } from '@/lib/haptics';
import { Text } from '~/components/text';
import { TextField } from '~/components/text-field';
import { useTheme } from '~/theme';

const BLUR_GRACE_MS = 150;

/**
 * Venue field with autocomplete over your own past venues, so the same bar
 * stops fragmenting into "Toit" / "toit" (src/components/ui/venue-input.tsx).
 */
export function VenueInput({
  value,
  onChange,
  venues,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  venues: VenueStat[];
  onSubmit?: () => void;
}) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  // Pressing a suggestion can blur the field before the press begins (a
  // browser blurs on pointer-down); hiding the list on that blur would swallow
  // the tap. So a blur closes the list only after a beat, and not at all while
  // a suggestion is under the finger.
  const pressingSuggestion = useRef(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);
  const suggestions = useMemo(() => suggestVenues(venues, value), [venues, value]);
  const showList = focused && suggestions.length > 0;

  const pick = (name: string) => {
    hapticSelection();
    pressingSuggestion.current = false;
    onChange(name);
    setFocused(false);
    // Keep typing focus, as the web does, so Go starts the session.
    inputRef.current?.focus();
  };

  return (
    <View>
      <TextField
        ref={inputRef}
        size="lg"
        icon={(color) => <MapPin size={20} color={color} />}
        value={value}
        onChangeText={(text) => {
          onChange(text);
          setFocused(true);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => {
            if (!pressingSuggestion.current) setFocused(false);
          }, BLUR_GRACE_MS);
        }}
        placeholder="Where are you drinking?"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType={onSubmit ? 'go' : 'done'}
        onSubmitEditing={() => {
          setFocused(false);
          onSubmit?.();
        }}
        accessibilityLabel="Venue"
      />
      {showList && (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(120)}
          style={[styles.list, { backgroundColor: colors.popoverStrongBg, borderColor: colors.cardBorder }]}
        >
          {suggestions.map((venue) => (
            <Pressable
              key={venue.key}
              accessibilityRole="button"
              onPressIn={() => {
                pressingSuggestion.current = true;
              }}
              onPressOut={() => {
                // A cancelled press (finger slid off) releases the hold; a
                // completed one is handled by onPress, which runs next.
                setTimeout(() => {
                  pressingSuggestion.current = false;
                  if (!inputRef.current?.isFocused()) setFocused(false);
                }, 0);
              }}
              onPress={() => pick(venue.name)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceSubtle }]}
            >
              <MapPin size={14} color={colors.muted} />
              <Text size={14} numberOfLines={1} style={{ flex: 1 }}>
                {venue.name}
              </Text>
              <Text size={10} tone="muted">
                {venue.visits}×
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 6, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
});
