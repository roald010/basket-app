import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type StoreChipProps = {
  monogram: string;
  /** Green marks the cheapest/selected store for this decision -- never a real brand color. */
  isCheapest?: boolean;
  size?: number;
};

export function StoreChip({ monogram, isCheapest, size = 30 }: StoreChipProps) {
  const theme = useTheme();
  const backgroundColor = isCheapest ? theme.chipCheapestBg : theme.chipNeutralBg;
  const color = isCheapest ? theme.chipCheapestText : theme.chipNeutralText;

  return (
    <View
      style={[
        styles.chip,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor },
      ]}>
      <ThemedText type="smallBold" style={{ color, fontSize: size * 0.4 }}>
        {monogram}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
