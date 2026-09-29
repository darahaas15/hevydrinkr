import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '~/components/text';
import { useTheme } from '~/theme';

/** "Drinkr" in the brand gradient (the web's `.gradient-text`). */
export function Wordmark({ size = 20 }: { size?: number }) {
  const { colors } = useTheme();
  const label = (
    <Text size={size} weight="extrabold" tracking={-0.025 * size} leading={1.2}>
      Drinkr
    </Text>
  );
  return (
    <MaskedView maskElement={label} accessibilityRole="header" accessibilityLabel="Drinkr">
      <LinearGradient
        colors={[colors.gradientTextFrom, colors.gradientTextTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text size={size} weight="extrabold" tracking={-0.025 * size} leading={1.2} style={{ opacity: 0 }}>
          Drinkr
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}
