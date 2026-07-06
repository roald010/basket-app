import { Pressable, StyleSheet, View } from 'react-native';

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
 * MVP -- text-only capture, see build plan) and Profiel's Budget/Balans/Premium tier.
 */
export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const theme = useTheme();

  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            disabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              selected && { backgroundColor: theme.chipCheapestBg },
              option.disabled && styles.disabled,
            ]}>
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
    flexDirection: 'row',
    gap: Spacing.half,
    borderRadius: 14,
    padding: Spacing.half,
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
