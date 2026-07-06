import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { EntityCard } from '@/components/ui/entity-card';
import { HonestGapCard } from '@/components/ui/honest-gap-card';
import { PriceText } from '@/components/ui/price-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StoreChip } from '@/components/ui/store-chip';
import { useListQuery } from '@/features/lists/api';
import { toOptimizerItems, useListItemMatchesQuery, useMatchListItemsMutation } from '@/features/matching/api';
import { bestCombos } from '@/features/matching/optimize';
import { useStoresQuery } from '@/features/stores/api';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

function useStoreComparison(listId: string) {
  const { data: matches = [] } = useListItemMatchesQuery(listId);
  const { data: stores = [] } = useStoresQuery();

  const combos = useMemo(() => bestCombos(toOptimizerItems(matches)), [matches]);
  const storesBySlug = useMemo(() => new Map(stores.map((store) => [store.slug, store])), [stores]);

  return { hasItems: matches.length > 0, combos, storesBySlug };
}

export default function ListHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: list, isLoading, isError } = useListQuery(id);
  const matchMutation = useMatchListItemsMutation();
  const matchTriggeredForListRef = useRef<string | null>(null);
  const { hasItems, combos, storesBySlug } = useStoreComparison(id);
  const [selectedCount, setSelectedCount] = useState('1');

  const selectedCombo = combos.find((combo) => String(combo.storeCount) === selectedCount) ?? combos[0];
  const singleStoreTotal = combos[0]?.total;
  const saving =
    selectedCombo && singleStoreTotal !== undefined && selectedCombo.storeCount > 1 && selectedCombo.coveredCount >= combos[0].coveredCount
      ? singleStoreTotal - selectedCombo.total
      : 0;

  useEffect(() => {
    if (!list || list.recipes.length === 0) return;
    if (matchTriggeredForListRef.current === list.id) return;
    matchTriggeredForListRef.current = list.id;
    matchMutation.mutate(list.id, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list-item-matches', list.id] }),
    });
  }, [list, matchMutation, queryClient]);

  const contentPlatformStyle = Platform.select({
    android: { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four },
    default: { paddingTop: Spacing.two, paddingBottom: insets.bottom + BottomTabInset },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={Spacing.two}>
            <ThemedText type="smallBold">‹</ThemedText>
          </Pressable>
        </View>

        {isLoading && <ThemedText themeColor="textSecondary">...</ThemedText>}
        {isError && <ThemedText themeColor="textSecondary">{t.review.commitError}</ThemedText>}

        {list && (
          <>
            <View style={styles.titleBlock}>
              <ThemedText type="title">{list.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t.home.recipesCount(list.recipes.length)} · {t.lists.createdToday}
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t.listHub.recipesInList.toUpperCase()}
              </ThemedText>
              {list.recipes.map((recipe) => (
                <EntityCard
                  key={recipe.id}
                  icon={<ThemedText>🍽️</ThemedText>}
                  title={recipe.name}
                  subtitle={t.listHub.servingsAndIngredients(recipe.servingsTarget, recipe.itemCount)}
                />
              ))}
              <Pressable
                onPress={() => router.push({ pathname: '/capture', params: { listId: list.id, listName: list.name } })}
                style={[styles.addRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" style={{ color: theme.chipCheapestBg }}>
                  + {t.listHub.addRecipe}
                </ThemedText>
              </Pressable>
            </View>

            {hasItems && selectedCombo ? (
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t.listHub.compareStores.toUpperCase()}
                </ThemedText>

                <SegmentedControl
                  value={selectedCount}
                  onChange={setSelectedCount}
                  options={combos.map((combo) => ({
                    value: String(combo.storeCount),
                    label: t.home.storesCount(combo.storeCount),
                  }))}
                />

                <View style={[styles.comboCard, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.comboHeader}>
                    <View style={styles.comboChips}>
                      {selectedCombo.chains.map((slug) => {
                        const store = storesBySlug.get(slug);
                        return store ? <StoreChip key={slug} monogram={store.monogram} isCheapest size={34} /> : null;
                      })}
                    </View>
                    <PriceText amount={selectedCombo.total} type="title" />
                  </View>
                  {saving > 0 && (
                    <ThemedText type="small" themeColor="textSecondary">
                      <PriceText amount={-saving} type="small" signed />
                      {' '}
                      {t.listHub.savingVsOne}
                    </ThemedText>
                  )}
                </View>

                {selectedCombo.gapCount > 0 && (
                  <HonestGapCard
                    title={t.listHub.itemsNotCovered(selectedCombo.gapCount)}
                    subtitle={t.listHub.pickYourself}
                  />
                )}
              </View>
            ) : (
              <HonestGapCard
                title={t.listHub.pricingComingSoonTitle}
                subtitle={t.listHub.pricingComingSoonSubtitle}
              />
            )}
          </>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlock: {
    gap: Spacing.half,
  },
  section: {
    gap: Spacing.two,
  },
  comboCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  comboHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  comboChips: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  addRow: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: Spacing.three,
  },
});
