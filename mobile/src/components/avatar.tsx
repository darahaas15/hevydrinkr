import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '~/components/text';
import { useTheme } from '~/theme';

const SIZES = { xs: [24, 8], sm: [32, 10], md: [40, 12], lg: [48, 14], xl: [64, 16] } as const;

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function Avatar({
  src,
  name,
  size = 'md',
  style,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const [px, fontSize] = SIZES[size];
  // A photo that fails to load falls back to initials, as on the web.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const frame = { width: px, height: px, borderRadius: px / 2 };

  if (src && src !== failedSrc) {
    return (
      <Image
        source={src}
        style={[frame, style as object]}
        contentFit="cover"
        transition={120}
        onError={() => setFailedSrc(src)}
        accessibilityLabel={name}
      />
    );
  }
  return (
    <View style={[frame, { backgroundColor: colors.avatarBg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text size={fontSize} weight="bold" color={colors.avatarFg} leading={1}>
        {initials(name)}
      </Text>
    </View>
  );
}
