import { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 20, stiffness: 400, mass: 0.6 };

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Extra style while the finger is down (the web's `active:` classes). */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Scale while pressed (the web's `whileTap`). 1 disables the squish. */
  scaleTo?: number;
}

/** A pressable that springs down under the finger, like the web's buttons. */
export function PressableScale({
  style,
  pressedStyle,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  disabled,
  accessibilityRole = 'button',
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      onPressIn={(e) => {
        setPressed(true);
        scale.set(withSpring(scaleTo, SPRING));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.set(withSpring(1, SPRING));
        onPressOut?.(e);
      }}
      style={[style, pressed && pressedStyle, animatedStyle]}
    />
  );
}
