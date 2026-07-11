import Svg, { Circle, Path } from 'react-native-svg';

export type NavIconName = 'home' | 'lists' | 'staples' | 'profile';

type NavIconProps = {
  name: NavIconName;
  color: string;
  size?: number;
  /** Home is the only icon with a filled state in the design (a light-green
   * fill behind the stroke) when active. */
  active?: boolean;
};

/** The bottom nav's icon set, traced from the design doc's own inline SVGs
 * (same viewBox="0 0 24 24" path data) rather than a generic icon library --
 * these are the brand's actual icons, not a lookalike substitute. */
export function NavIcon({ name, color, size = 24, active = false }: NavIconProps) {
  switch (name) {
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z"
            stroke={color}
            strokeWidth={1.7}
            strokeLinejoin="round"
            fill={active ? '#DCEEE3' : 'none'}
          />
        </Svg>
      );
    case 'lists':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 8h16l-1.3 9a2 2 0 0 1-2 1.7H7.3a2 2 0 0 1-2-1.7L4 8Z"
            stroke={color}
            strokeWidth={1.9}
            strokeLinejoin="round"
          />
          <Path d="M8.5 8 12 3.5 15.5 8" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'staples':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 7h8M16 7h4M4 12h4M12 12h8M4 17h10M18 17h2" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
          <Circle cx={14} cy={7} r={2.3} stroke={color} strokeWidth={1.7} />
          <Circle cx={8} cy={12} r={2.3} stroke={color} strokeWidth={1.7} />
          <Circle cx={16} cy={17} r={2.3} stroke={color} strokeWidth={1.7} />
        </Svg>
      );
  }
}
