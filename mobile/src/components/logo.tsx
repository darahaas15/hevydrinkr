import Svg, { G, Path } from 'react-native-svg';

/** The brand wine glass (src/components/ui/logo.tsx). */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke="#14b8a6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M8 22h8" />
        <Path d="M7 10h10" />
        <Path d="M12 15v7" />
        <Path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
      </G>
    </Svg>
  );
}
