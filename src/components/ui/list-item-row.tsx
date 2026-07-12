import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PriceText } from '@/components/ui/price-text';
import { ProductIcon, matchProductCategory } from '@/components/ui/product-icon';
import type { ProductTier } from '@/features/matching/api';
import { BrandColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

export type ListItemRowProps = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  /** The item's matched price at the single-cheapest-store baseline; undefined when unmatched (honest gap -- shows nothing, never €0,00). */
  price?: number;
  /** The actually-matched product's own name/tier at that same baseline chain -- shown
   * as a caption so it's clear which real product (and tier) the price is for. */
  matchedProductName?: string | null;
  matchedProductTier?: ProductTier | null;
  /** Shows a "kies soort" pill: the item resolves to several distinct product kinds and
   * the user hasn't chosen one yet. Tapping the row opens the kind chooser. */
  needsChoice?: boolean;
  /** Opens the product-kind chooser; only passed for items that can be re-matched. */
  onPress?: () => void;
  onRemove?: () => void;
};

/** One line inside an expanded recipe/staples/manual-products section -- the single
 * shared row shape so all three read as one list instead of three different card
 * styles, per icon + name + quantity + price (+ optional remove action). */
export function ListItemRow({
  name,
  quantity,
  unit,
  price,
  matchedProductName,
  matchedProductTier,
  needsChoice,
  onPress,
  onRemove,
}: ListItemRowProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const tierLabel = matchedProductTier ? tierLabelFor(matchedProductTier, t) : null;

  const row = (
    <View style={[styles.row, { borderColor: theme.backgroundElement }]}>
      <ProductIcon category={matchProductCategory(name)} color={theme.textSecondary} size={16} />
      <View style={styles.textColumn}>
        <ThemedText type="small" numberOfLines={1}>
          {name}
        </ThemedText>
        {matchedProductName && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {matchedProductName}
            {tierLabel ? ` · ${tierLabel}` : ''}
          </ThemedText>
        )}
      </View>
      {needsChoice && (
        <View style={[styles.pill, { borderColor: BrandColors.green }]}>
          <ThemedText type="small" style={{ color: BrandColors.green }}>
            {t.listHub.needsChoice}
          </ThemedText>
        </View>
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

  if (!onPress) return row;
  return <Pressable onPress={onPress}>{row}</Pressable>;
}

function tierLabelFor(tier: ProductTier, t: ReturnType<typeof useTranslation>['t']) {
  return { budget: t.listHub.tierBudget, standard: t.listHub.tierStandard, premium: t.listHub.tierPremium }[tier];
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
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
  },
});
