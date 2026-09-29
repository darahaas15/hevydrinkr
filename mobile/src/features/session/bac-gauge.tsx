import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import type { DrinkEntry } from '@/types';
import {
  BEER_GAUGE_MAX_ML,
  GAUGE_MAX_STANDARD_DRINKS,
  SPIRITS_GAUGE_MAX_ML,
  beerVolumeMl,
  drinkLevel,
  gaugeProgress,
  gaugeVolumeLabel,
  spiritsVolumeMl,
} from '@/lib/drink-gauge';
import { Text } from '~/components/text';
import { fonts, gaugeColor, useTheme } from '~/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A half-circle arc that animates to `progress` (the web's motion.path). */
function Arc({
  radius,
  strokeWidth,
  progress,
  color,
  track,
  duration,
}: {
  radius: number;
  strokeWidth: number;
  progress: number;
  color: string;
  track: string;
  duration: number;
}) {
  const center = radius + strokeWidth;
  const circumference = Math.PI * radius;
  const offset = useSharedValue(circumference);
  useEffect(() => {
    offset.set(withTiming(circumference * (1 - progress), { duration, easing: Easing.out(Easing.ease) }));
  }, [offset, circumference, progress, duration]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const d = `M ${strokeWidth} ${center} A ${radius} ${radius} 0 0 1 ${center * 2 - strokeWidth} ${center}`;
  return (
    <>
      <Path d={d} fill="none" strokeWidth={strokeWidth} strokeLinecap="round" stroke={track} />
      <AnimatedPath
        d={d}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        stroke={color}
        strokeDasharray={circumference}
        animatedProps={animatedProps}
      />
    </>
  );
}

function MiniGauge({ value, max, label, color, scale }: { value: number; max: number; label: string; color: string; scale: number }) {
  const { colors } = useTheme();
  const r = 40;
  const sw = 6;
  const cx = r + sw;
  const volume = gaugeVolumeLabel(value);
  return (
    <View style={styles.gauge}>
      <Svg width={cx * 2 * scale} height={(cx + 10) * scale} viewBox={`0 0 ${cx * 2} ${cx + 10}`}>
        <Arc radius={r} strokeWidth={sw} progress={gaugeProgress(value, max)} color={color} track={colors.borderFaint} duration={500} />
        <SvgText x={cx} y={cx - 4} textAnchor="middle" fill={colors.foreground} fontFamily={fonts.monoBold} fontSize={18}>
          {volume.value}
        </SvgText>
        <SvgText x={cx} y={cx + 10} textAnchor="middle" fill={colors.mutedForeground} fontFamily={fonts.regular} fontSize={10}>
          {volume.unit}
        </SvgText>
      </Svg>
      <Text size={10} tone="fgSecondary" style={{ marginTop: -2 }}>
        {label}
      </Text>
    </View>
  );
}

// The three gauges' natural widths (92 + 134 + 92), and the two 8pt gaps.
const GAUGES_WIDTH = 318;
const GAPS_WIDTH = 16;
// The card's padding and border on both sides.
const CARD_INSET = 2 * (16 + 1);

/** The live-session drink gauge (src/components/session/bac-gauge.tsx). */
export function BacGauge({ standardDrinks, drinks }: { standardDrinks: number; drinks: DrinkEntry[] }) {
  const { colors } = useTheme();
  // The card's inner width; shrinks the gauges to fit narrow phones instead of
  // overflowing the card. Degenerate widths from early layout passes are
  // ignored rather than producing a negative scale.
  const [innerWidth, setInnerWidth] = useState(GAUGES_WIDTH + GAPS_WIDTH);
  const scale = Math.min(1, (innerWidth - GAPS_WIDTH) / GAUGES_WIDTH);
  const { label, level } = drinkLevel(standardDrinks);
  const color = gaugeColor(colors, level);
  const radius = 60;
  const strokeWidth = 7;
  const center = radius + strokeWidth;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.hairline }]}
      onLayout={(e) => {
        const inner = e.nativeEvent.layout.width - CARD_INSET;
        if (inner > GAUGES_WIDTH / 2) setInnerWidth(inner);
      }}
    >
      <View style={styles.row}>
        <MiniGauge value={spiritsVolumeMl(drinks)} max={SPIRITS_GAUGE_MAX_ML} label="Spirits" color={colors.violet} scale={scale} />
        <View style={styles.gauge}>
          <Svg width={center * 2 * scale} height={(center + 12) * scale} viewBox={`0 0 ${center * 2} ${center + 12}`}>
            <Arc
              radius={radius}
              strokeWidth={strokeWidth}
              progress={gaugeProgress(standardDrinks, GAUGE_MAX_STANDARD_DRINKS)}
              color={color}
              track={colors.borderFaint}
              duration={600}
            />
            <SvgText x={center} y={center - 8} textAnchor="middle" fill={colors.foreground} fontFamily={fonts.monoBold} fontSize={24}>
              {standardDrinks.toFixed(1)}
            </SvgText>
            <SvgText x={center} y={center + 7} textAnchor="middle" fill={colors.mutedForeground} fontFamily={fonts.regular} fontSize={10}>
              std drinks
            </SvgText>
          </Svg>
          <Text size={11} weight="semibold" color={color} style={{ marginTop: -2 }}>
            {label}
          </Text>
        </View>
        <MiniGauge value={beerVolumeMl(drinks)} max={BEER_GAUGE_MAX_ML} label="Beer" color={colors.gauge3} scale={scale} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  gauge: { alignItems: 'center' },
});
