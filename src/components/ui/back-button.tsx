import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BackButtonProps = {
  onPress: () => void;
};

/** Full-screen (non-sheet) routes only -- formSheet screens like capture/review
 * already have their own dismiss affordance and don't need this. */
export function BackButton({ onPress }: BackButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={Spacing.two}
      style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M15 6l-6 6 6 6" stroke={theme.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
