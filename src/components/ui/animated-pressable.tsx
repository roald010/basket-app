import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export type AnimatedPressableProps = Omit<PressableProps, 'style'> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
};

/** Shared tap-feedback primitive -- a light spring scale-down on press-in, spring back
 * on release. Used across buttons/cards so interactive elements feel consistently
 * responsive instead of the previous mix of instant-opacity-only or no feedback. */
export function AnimatedPressable({ scaleTo = 0.96, style, onPressIn, onPressOut, ...rest }: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressableBase
      style={[animatedStyle, style]}
      onPressIn={(event) => {
        // Reanimated shared values are meant to be mutated via .value; the
        // react-compiler plugin doesn't recognize that convention yet.
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withSpring(scaleTo, { damping: 16, stiffness: 300 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        // eslint-disable-next-line react-hooks/immutability -- see onPressIn above.
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
        onPressOut?.(event);
      }}
      {...rest}
    />
  );
}
