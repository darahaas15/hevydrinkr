import { DRINK_CATEGORY_ICONS, DRINK_CATEGORY_COLORS } from '@/lib/constants';
import { IconCup } from '@tabler/icons-react';

function WhiskeyGlass({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d="M5 3h14l-2 15H7L5 3z" />
      <path d="M6 8h12" />
      <path d="M9 21h6" />
      <path d="M10 18l-1 3" />
      <path d="M14 18l1 3" />
    </svg>
  );
}

interface DrinkIconProps {
  category: string;
  className?: string;
  size?: number;
}

export function DrinkIcon({ category, className = 'w-5 h-5', size }: DrinkIconProps) {
  const color = DRINK_CATEGORY_COLORS[category] || '#71717a';

  if (category === 'whiskey') {
    return <WhiskeyGlass className={className} style={{ color }} />;
  }

  const Icon = DRINK_CATEGORY_ICONS[category] || IconCup;
  return <Icon className={className} style={{ color }} stroke={1.5} size={size} />;
}
