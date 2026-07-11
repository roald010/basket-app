import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type WithSpringConfig } from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

const DEFAULT_PRESS_IN_SPRING: WithSpringConfig = { damping: 16, stiffness: 300 };
const DEFAULT_PRESS_OUT_SPRING: WithSpringConfig = { damping: 12, stiffness: 220 };

export type AnimatedPressableProps = Omit<PressableProps, 'style'> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  /** Overrides the default press-feedback spring, e.g. to match another animation's speed. */
  springConfig?: WithSpringConfig;
};

/** Shared tap-feedback primitive -- a light spring scale-down on press-in, spring back
 * on release. Used across buttons/cards so interactive elements feel consistently
 * responsive instead of the previous mix of instant-opacity-only or no feedback. */
export function AnimatedPressable({
  scaleTo = 0.96,
  style,
  onPressIn,
  onPressOut,
  springConfig,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pressInSpring = springConfig ?? DEFAULT_PRESS_IN_SPRING;
  const pressOutSpring = springConfig ?? DEFAULT_PRESS_OUT_SPRING;

  return (
    <AnimatedPressableBase
      style={[animatedStyle, style]}
      onPressIn={(event) => {
        // Reanimated shared values are meant to be mutated via .value; the
        // react-compiler plugin doesn't recognize that convention yet.
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withSpring(scaleTo, pressInSpring);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        // eslint-disable-next-line react-hooks/immutability -- see onPressIn above.
        scale.value = withSpring(1, pressOutSpring);
        onPressOut?.(event);
      }}
      {...rest}
    />
  );
}
