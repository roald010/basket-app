import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
};

/** A loading placeholder block with a light sweep animation, instead of a plain "..."
 * text -- see SkeletonCard below for the shapes actually used across screens. */
export function Skeleton({ width = '100%', height = 16, borderRadius = 8 }: SkeletonProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [progress]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${Math.round(progress.value * 220 - 60)}%` as `${number}%` }],
  }));

  return (
    <View style={[styles.base, { width, height, borderRadius, backgroundColor: theme.backgroundElement }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          sweepStyle,
          { experimental_backgroundImage: `linear-gradient(90deg, transparent, ${theme.backgroundSelected}, transparent)` },
        ]}
      />
    </View>
  );
}

/** Matches the icon-tile + two-line-text + trailing-price shape shared by EntityCard,
 * staples rows, and list cards -- one skeleton stands in for any of them while loading. */
export function SkeletonCard() {
  const theme = useTheme();
  return (
    <View style={[cardStyles.card, { borderColor: theme.backgroundElement }]}>
      <Skeleton width={44} height={44} borderRadius={12} />
      <View style={cardStyles.text}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="45%" height={11} />
      </View>
      <Skeleton width={48} height={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
});
