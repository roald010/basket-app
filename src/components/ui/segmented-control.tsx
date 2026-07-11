import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentedOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SegmentedControlProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
};

/**
 * Shared by Capture's Tekst/Link/Foto tabs (Link and Foto pass disabled: true for the
 * MVP -- text-only capture, see build plan), Profiel's Budget/Balans/Premium tier, List
 * Hub's 1/2/3-store selector, and Settings' NL/EN. One indicator pill slides between
 * segments instead of each segment independently flipping its own background.
 */
export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const theme = useTheme();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const segmentWidth = 100 / options.length;
  const offset = useSharedValue(selectedIndex * segmentWidth);

  useEffect(() => {
    offset.value = withTiming(selectedIndex * segmentWidth, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [selectedIndex, segmentWidth, offset]);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: `${offset.value}%`,
  }));

  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      <Animated.View style={[styles.indicator, indicatorStyle, { width: `${segmentWidth}%`, backgroundColor: theme.chipCheapestBg }]} />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            disabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={[styles.segment, option.disabled && styles.disabled]}>
            <ThemedText
              type={selected ? 'smallBold' : 'small'}
              style={{ color: selected ? theme.chipCheapestText : theme.textSecondary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    // No gap: the indicator's position/width are computed as plain percentages of the
    // track, which only lines up with each segment's flex-1 share when there's no gap
    // eating into that math. The pill's own small marginHorizontal below stands in for
    // the visual breathing room a gap would have given.
    flexDirection: 'row',
    borderRadius: 14,
    padding: Spacing.half,
  },
  indicator: {
    position: 'absolute',
    top: Spacing.half,
    bottom: Spacing.half,
    marginHorizontal: 2,
    borderRadius: 10,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  disabled: {
    opacity: 0.45,
  },
});
