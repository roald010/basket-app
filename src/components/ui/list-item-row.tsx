import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PriceText } from '@/components/ui/price-text';
import { ProductIcon, matchProductCategory } from '@/components/ui/product-icon';
import { BrandColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ListItemRowProps = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  /** The item's matched price at the single-cheapest-store baseline; undefined when unmatched (honest gap -- shows nothing, never €0,00). */
  price?: number;
  /** A standardized, store-agnostic product-kind label (e.g. "Blok kaas · ~500 g") shown as
   * a caption -- NEVER a specific supermarket's own product name/SKU. Null when we can't
   * characterize the match well enough to offer a label. */
  kindLabel?: string | null;
  /** Colors the edit icon green (drawing attention) instead of muted gray: there's genuine
   * doubt about which kind the user meant (see needsKindChoice) and they haven't chosen one
   * yet. Only meaningful when `onPress` is also set. */
  needsChoice?: boolean;
  /** Opens the product-kind chooser. Only passed for items that can be re-matched; when set,
   * a small edit-pencil icon appears as the ONLY tap target for it -- never the whole row --
   * so there's always a visible affordance for whatever is actually tappable. */
  onPress?: () => void;
  onRemove?: () => void;
};

/** One line inside an expanded recipe/staples/manual-products section -- the single
 * shared row shape so all three read as one list instead of three different card
 * styles, per icon + name + quantity + price (+ optional remove action). */
export function ListItemRow({ name, quantity, unit, price, kindLabel, needsChoice, onPress, onRemove }: ListItemRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderColor: theme.backgroundElement }]}>
      <ProductIcon category={matchProductCategory(name)} color={theme.textSecondary} size={16} />
      <View style={styles.textColumn}>
        <ThemedText type="small" numberOfLines={1}>
          {name}
        </ThemedText>
        {kindLabel && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {kindLabel}
          </ThemedText>
        )}
      </View>
      {onPress && (
        <Pressable onPress={onPress} hitSlop={Spacing.two}>
          <ThemedText style={[styles.editIcon, { color: needsChoice ? BrandColors.green : theme.textSecondary }]}>✎</ThemedText>
        </Pressable>
      )}
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
  textColumn: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  editIcon: {
    fontSize: 14,
  },
});
