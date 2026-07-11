import { useEffect, type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { useIsFocused } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Module-level, not a ref -- shared across every screen's TabScreenTransition instance
// so each one can tell whether the tab it's becoming active from was to its left or
// right, without needing a context provider.
let lastFocusedRouteIndex = 0;

type TabScreenTransitionProps = PropsWithChildren<{
  /** This screen's position in the tab bar (Home=0, Lists=1, Staples=2, Profile=3) --
   * only used to pick which side the content slides in from. */
  routeIndex: number;
}>;

/**
 * Replays a small slide + fade every time this screen becomes the active tab.
 *
 * Lives entirely inside each screen's own render tree -- a plain wrapping View plus
 * the standard `useIsFocused` hook -- rather than touching TabSlot/react-native-screens
 * internals. An earlier attempt to animate at that layer (wrapping each screen inside
 * TabSlot's own renderFn in an absolutely-positioned Animated.View) broke the native
 * Screen container's layout badly enough that the entire tab bar disappeared. This is
 * the safe version: nothing here can affect the tab bar or the Screen container, it
 * only animates content a screen already owns.
 */
export function TabScreenTransition({ routeIndex, children }: TabScreenTransitionProps) {
  const isFocused = useIsFocused();
  const progress = useSharedValue(0);
  const direction = useSharedValue(1);

  useEffect(() => {
    if (!isFocused) return;
    direction.value = routeIndex >= lastFocusedRouteIndex ? 1 : -1;
    lastFocusedRouteIndex = routeIndex;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [isFocused, routeIndex, progress, direction]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * 20 * direction.value }],
  }));

  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
