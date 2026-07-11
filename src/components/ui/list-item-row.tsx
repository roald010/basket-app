import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PriceText } from '@/components/ui/price-text';
import { ProductIcon, matchProductCategory } from '@/components/ui/product-icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ListItemRowProps = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  /** The item's matched price at the single-cheapest-store baseline; undefined when unmatched (honest gap -- shows nothing, never €0,00). */
  price?: number;
  onRemove?: () => void;
};

/** One line inside an expanded recipe/staples/manual-products section -- the single
 * shared row shape so all three read as one list instead of three different card
 * styles, per icon + name + quantity + price (+ optional remove action). */
export function ListItemRow({ name, quantity, unit, price, onRemove }: ListItemRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderColor: theme.backgroundElement }]}>
      <ProductIcon category={matchProductCategory(name)} color={theme.textSecondary} size={16} />
      <ThemedText type="small" style={styles.name} numberOfLines={1}>
        {name}
      </ThemedText>
      {quantity != null && (
        <ThemedText type="small" themeColor="textSecondary">
          {quantity}
          {unit ? ` ${unit}` : ''}
        </ThemedText>
      )}
      {price !== undefined && <PriceText amount={price} type="small" />}
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={Spacing.two}>
          <ThemedText themeColor="textSecondary">✕</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: 1,
    paddingVertical: Spacing.one + 2,
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
});
