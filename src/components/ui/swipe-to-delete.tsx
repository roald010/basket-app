import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const DESTRUCTIVE_RED = '#E5484D';

function DeleteAction({ progress, onPress, label }: { progress: SharedValue<number>; onPress: () => void; label: string }) {
  // Scales/fades in with the swipe itself instead of popping in fully-formed the
  // instant the action row starts rendering -- a smooth reveal reads far more
  // intentional than an abrupt appearance.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.5, 1], Extrapolation.CLAMP) }],
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.actionWrap, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[styles.action, { backgroundColor: DESTRUCTIVE_RED }]}
      >
        <ThemedText style={styles.icon}>✕</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

export type SwipeToDeleteProps = PropsWithChildren<{
  onDelete: () => void;
  /** Accessibility label for the revealed delete button, e.g. "Delete Weekmenu". */
  deleteLabel: string;
}>;

/**
 * Reveals a red delete action when swiped left, with a smooth scale/fade reveal tied
 * to the swipe gesture itself. The swipe is the confirmation, matching the iOS Mail
 * delete pattern -- no popup. Shared across Lists, Staples, and Home's recent-lists row
 * so every swipeable card in the app looks and behaves identically.
 */
export function SwipeToDelete({ onDelete, deleteLabel, children }: SwipeToDeleteProps) {
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(progress) => <DeleteAction progress={progress} onPress={onDelete} label={deleteLabel} />}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actionWrap: {
    justifyContent: 'center',
    marginLeft: Spacing.two,
  },
  action: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    height: '100%',
    borderRadius: 16,
  },
  icon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
});
