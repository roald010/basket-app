import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function Chevron({ expanded, color }: { expanded: boolean; color: string }) {
  const rotation = useSharedValue(expanded ? 180 : 0);
  rotation.value = withTiming(expanded ? 180 : 0, { duration: 220 });
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View style={style}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

type ExpandableProps = PropsWithChildren<{
  expanded: boolean;
  onToggle: () => void;
  /** The always-visible summary row (icon/title/subtitle/price, etc). */
  header: ReactNode;
  /** Rendered outside the tappable header, e.g. a Toggle switch that shouldn't also trigger expand/collapse. */
  trailing?: ReactNode;
  style?: ViewStyle;
}>;

/** A summary row that expands to reveal detail rows underneath -- used on List Hub for
 * both Staples and Recipes so the user can see every product in the list without
 * leaving the screen. Chevron rotation and content enter/exit run on the UI thread
 * (Reanimated worklets); the wrapping LinearTransition smoothly reflows whatever sits
 * below as the card grows or shrinks, instead of everything just jumping. */
export function Expandable({ expanded, onToggle, header, trailing, style, children }: ExpandableProps) {
  const theme = useTheme();

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundElement }, style]}>
      <View style={styles.row}>
        <Pressable onPress={onToggle} style={({ pressed }) => [styles.headerPressable, pressed && styles.pressed]}>
          {header}
          <Chevron expanded={expanded} color={theme.textSecondary} />
        </Pressable>
        {trailing}
      </View>
      {expanded && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.content}>
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.65,
  },
  content: {
    gap: Spacing.half,
  },
});
