import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

function Glow({ size, color, opacity, style }: { size: number; color: string; opacity: number; style: object }) {
  const id = `glow-${color.slice(1)}`;
  return (
    <Svg width={size} height={size} style={[styles.glow, style]}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.6" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={size / 2} cy={size / 2} rx={size / 2} ry={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/** The faint teal and cyan glows behind the web's landing and auth screens. */
export function AmbientGlow() {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Glow size={600} color="#14b8a6" opacity={0.07} style={{ top: '-20%', alignSelf: 'center' }} />
      <Glow size={400} color="#06b6d4" opacity={0.05} style={{ bottom: '-10%', left: '-10%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', pointerEvents: 'none' },
});
