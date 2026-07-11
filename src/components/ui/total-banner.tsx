import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { formatEUR } from '@/components/ui/price-text';
import { BrandColors, Spacing } from '@/constants/theme';

export type TotalBannerProps = {
  ctaLabel: string;
  amount: number;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * The sticky bottom bar with a price and a primary CTA -- reused across the List Hub
 * ("Vergelijk winkels"), Compare ("Kies N winkels · start"), and identically shaped
 * on Shopping's "Route naar ... · opent Maps" bar (see button.tsx for that variant).
 */
export function TotalBanner({ ctaLabel, amount, onPress, disabled }: TotalBannerProps) {
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.98}
      style={[styles.bar, { opacity: disabled ? 0.5 : 1 }]}>
      <ThemedText type="smallBold" style={styles.label}>
        {ctaLabel}
      </ThemedText>
      <ThemedText type="title" tabularNums style={styles.amount}>
        {formatEUR(amount)}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BrandColors.green,
    borderRadius: 15,
    padding: Spacing.three,
  },
  label: {
    color: '#FFFFFF',
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
  },
});
