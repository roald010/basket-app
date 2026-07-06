import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PriceText } from '@/components/ui/price-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type EntityCardProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  /** e.g. a cluster of <StoreChip /> next to the subtitle, small-size. */
  chips?: React.ReactNode;
  price?: number;
  priceCaption?: string;
  onPress?: () => void;
  style?: ViewStyle;
};

/**
 * The one card shape shared by "recipe in a List Hub" and "list in the Home feed" --
 * deliberately unified rather than kept as two near-duplicate components.
 */
export function EntityCard({ icon, title, subtitle, chips, price, priceCaption, onPress, style }: EntityCardProps) {
  const theme = useTheme();
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundElement }, style]}>
      <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>{icon}</View>
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {title}
        </ThemedText>
        <View style={styles.subtitleRow}>
          {chips}
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        </View>
      </View>
      {price !== undefined && (
        <View style={styles.priceColumn}>
          <PriceText amount={price} />
          {priceCaption && (
            <ThemedText type="small" themeColor="textSecondary">
              {priceCaption}
            </ThemedText>
          )}
        </View>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 1,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
});
