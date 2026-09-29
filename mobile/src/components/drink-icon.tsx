import type { ComponentType } from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconCup } from '@tabler/icons-react-native';
import { DRINK_CATEGORY_COLORS, DRINK_CATEGORY_ICONS } from '@/lib/constants';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// The web app's custom rocks glass (see src/components/ui/drink-icon.tsx).
function WhiskeyGlass({ size = 20, color, strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 3h14l-2 15H7L5 3z" />
      <Path d="M6 8h12" />
      <Path d="M9 21h6" />
      <Path d="M10 18l-1 3" />
      <Path d="M14 18l1 3" />
    </Svg>
  );
}

/** A drink's category icon in its category colour, as on the web. */
export function DrinkIcon({ category, size = 20 }: { category: string; size?: number }) {
  const color = DRINK_CATEGORY_COLORS[category] || '#71717a';
  if (category === 'whiskey') return <WhiskeyGlass size={size} color={color} />;
  // Shared constants map categories to Tabler icons; metro.config.js points
  // '@tabler/icons-react' at its React Native build.
  const Icon = (DRINK_CATEGORY_ICONS[category] || IconCup) as ComponentType<IconProps>;
  return <Icon size={size} color={color} strokeWidth={1.5} />;
}
