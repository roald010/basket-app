import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function Stepper({ value, onChange, min = 0, max = 99, step = 1 }: StepperProps) {
  const theme = useTheme();
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View style={styles.row}>
      <Pressable
        disabled={atMin}
        onPress={() => onChange(Math.max(min, value - step))}
        style={[styles.control, { backgroundColor: theme.backgroundElement, opacity: atMin ? 0.4 : 1 }]}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          –
        </ThemedText>
      </Pressable>
      <ThemedText type="smallBold" tabularNums style={styles.value}>
        {value}
      </ThemedText>
      <Pressable
        disabled={atMax}
        onPress={() => onChange(Math.min(max, value + step))}
        style={[styles.control, { backgroundColor: theme.chipCheapestBg, opacity: atMax ? 0.4 : 1 }]}>
        <ThemedText type="smallBold" style={{ color: theme.chipCheapestText }}>
          +
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
  },
  control: {
    width: 31,
    height: 31,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 16,
    textAlign: 'center',
  },
});
