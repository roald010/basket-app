import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/back-button';
import { PriceText } from '@/components/ui/price-text';
import { SkeletonCard } from '@/components/ui/skeleton';
import { StoreChip } from '@/components/ui/store-chip';
import { useStoresQuery } from '@/features/stores/api';
import {
  useShoppingItemsQuery,
  useToggleItemCheckedMutation,
  type ShoppingItem,
} from '@/features/shopping/api';
import { BottomTabInset, BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

type StoreGroup = { chainSlug: string; items: ShoppingItem[]; subtotal: number };

function groupByStore(items: ShoppingItem[]) {
  const byChain = new Map<string, ShoppingItem[]>();
  const gapItems: ShoppingItem[] = [];
  for (const item of items) {
    if (item.assignedChainSlug === null) {
      gapItems.push(item);
      continue;
    }
    const bucket = byChain.get(item.assignedChainSlug) ?? [];
    bucket.push(item);
    byChain.set(item.assignedChainSlug, bucket);
  }

  const groups: StoreGroup[] = [...byChain.entries()]
    .map(([chainSlug, groupItems]) => ({
      chainSlug,
      items: groupItems,
      subtotal: groupItems.reduce((sum, item) => sum + (item.price ?? 0), 0),
    }))
    .sort((a, b) => a.subtotal - b.subtotal);

  const total = groups.reduce((sum, group) => sum + group.subtotal, 0);
  return { groups, gapItems, total };
}

function CheckRow({ item, onToggle }: { item: ShoppingItem; onToggle: (next: boolean) => void }) {
  const theme = useTheme();
  const quantityLabel = item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : item.unit ?? '';

  return (
    <Pressable style={styles.row} onPress={() => onToggle(!item.isChecked)} hitSlop={Spacing.one}>
      <View
        style={[
          styles.checkbox,
          { borderColor: theme.backgroundSelected },
          item.isChecked && { backgroundColor: BrandColors.green, borderColor: BrandColors.green },
        ]}>
        {item.isChecked && <ThemedText style={styles.checkmark}>✓</ThemedText>}
      </View>
      <View style={styles.rowText}>
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={item.isChecked ? { color: theme.textSecondary, textDecorationLine: 'line-through' } : undefined}>
          {item.name}
        </ThemedText>
        {quantityLabel ? (
          <ThemedText type="small" themeColor="textSecondary">
            {quantityLabel}
          </ThemedText>
        ) : null}
      </View>
      {item.price != null && <PriceText amount={item.price} color={item.isChecked ? theme.textSecondary : undefined} />}
    </Pressable>
  );
}

export default function ShoppingScreen() {
  const { id, listName } = useLocalSearchParams<{ id: string; listName?: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: items = [], isLoading, isError } = useShoppingItemsQuery(id);
  const { data: stores = [] } = useStoresQuery();
  const toggle = useToggleItemCheckedMutation(id);

  const storesBySlug = useMemo(() => new Map(stores.map((store) => [store.slug, store])), [stores]);
  const { groups, gapItems, total } = useMemo(() => groupByStore(items), [items]);

  const contentPlatformStyle = Platform.select({
    android: { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four },
    ios: { paddingTop: insets.top, paddingBottom: insets.bottom + BottomTabInset },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>

        <View style={styles.titleBlock}>
          <ThemedText type="title" numberOfLines={2}>
            {listName ?? t.capture.newListDefaultName}
          </ThemedText>
          {total > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {t.shopping.total} <PriceText amount={total} type="small" />
            </ThemedText>
          )}
        </View>

        {isLoading && (
          <View style={styles.section}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        )}
        {isError && <ThemedText themeColor="textSecondary">{t.review.commitError}</ThemedText>}
        {!isLoading && !isError && items.length === 0 && (
          <ThemedText themeColor="textSecondary">{t.shopping.empty}</ThemedText>
        )}

        {groups.map((group) => {
          const store = storesBySlug.get(group.chainSlug);
          return (
            <View key={group.chainSlug} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  {store && <StoreChip slug={store.slug} displayName={store.displayName} monogram={store.monogram} isCheapest size={28} />}
                  <ThemedText type="smallBold">{store?.displayName ?? group.chainSlug}</ThemedText>
                </View>
                <PriceText amount={group.subtotal} type="smallBold" />
              </View>
              <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                {group.items.map((item) => (
                  <CheckRow key={item.id} item={item} onToggle={(next) => toggle.mutate({ itemId: item.id, isChecked: next })} />
                ))}
              </View>
            </View>
          );
        })}

        {gapItems.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t.shopping.pickYourselfSection.toUpperCase()}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.shopping.pickYourselfHint}
            </ThemedText>
            <View style={[styles.card, { backgroundColor: theme.honestGapBg, borderColor: theme.honestGapBorder, borderWidth: 1 }]}>
              {gapItems.map((item) => (
                <CheckRow key={item.id} item={item} onToggle={(next) => toggle.mutate({ itemId: item.id, isChecked: next })} />
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  titleBlock: { gap: Spacing.half },
  section: { gap: Spacing.two },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#FFFFFF', fontSize: 14, lineHeight: 16 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
});
