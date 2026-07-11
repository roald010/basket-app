import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackButton } from '@/components/ui/back-button';
import { EntityCard } from '@/components/ui/entity-card';
import { Expandable } from '@/components/ui/expandable';
import { HonestGapCard } from '@/components/ui/honest-gap-card';
import { ListItemRow } from '@/components/ui/list-item-row';
import { PriceText } from '@/components/ui/price-text';
import { ProductIcon } from '@/components/ui/product-icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SkeletonCard } from '@/components/ui/skeleton';
import { StoreChip } from '@/components/ui/store-chip';
import { Toggle } from '@/components/ui/toggle';
import { TotalBanner } from '@/components/ui/total-banner';
import {
  useAddManualItemMutation,
  useListQuery,
  useRemoveListItemMutation,
  useRenameListMutation,
  useSetIncludeStaplesMutation,
} from '@/features/lists/api';
import { toOptimizerItems, useListItemMatchesQuery, useMatchListItemsMutation } from '@/features/matching/api';
import { assignItems, bestCombos } from '@/features/matching/optimize';
import { useCommitSelectionMutation } from '@/features/shopping/api';
import { useStoresQuery } from '@/features/stores/api';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';
import { formatListDate } from '@/lib/format-date';

function useStoreComparison(listId: string, includeStaples: boolean) {
  const { data: matches = [] } = useListItemMatchesQuery(listId);
  const { data: stores = [] } = useStoresQuery();

  // Only staple-sourced rows are ever excluded, and only when the toggle is off --
  // recipe and manual ("Losse producten") rows always count toward Compare.
  const includedMatches = useMemo(
    () => matches.filter((match) => includeStaples || match.sourceType !== 'staple'),
    [matches, includeStaples]
  );
  const optimizerItems = useMemo(() => toOptimizerItems(includedMatches), [includedMatches]);
  const combos = useMemo(() => bestCombos(optimizerItems), [optimizerItems]);
  const storesBySlug = useMemo(() => new Map(stores.map((store) => [store.slug, store])), [stores]);

  // Per-item price at the single-cheapest-store baseline -- shown on every expanded
  // row (recipe ingredient, staple, manual product) regardless of which combo the user
  // later picks, so rows don't jump around as the 1/2/3-store selector changes. Same
  // baseline recipePrices below sums from.
  const itemAssignments = useMemo(
    () => (combos.length === 0 ? [] : assignItems(optimizerItems, combos[0].chains)),
    [optimizerItems, combos]
  );
  const itemPrices = useMemo(
    () => new Map(itemAssignments.map((assignment) => [assignment.listItemId, assignment.price])),
    [itemAssignments]
  );

  // Per-recipe subtotal at the single cheapest store -- shown on each recipe row
  // regardless of which combo the user later picks, so recipe cards don't jump around
  // as the 1/2/3-store selector changes.
  const recipePrices = useMemo(() => {
    const totals = new Map<string, number>();
    const recipeIdByItem = new Map(includedMatches.map((match) => [match.listItemId, match.recipeId]));
    for (const assignment of itemAssignments) {
      const recipeId = recipeIdByItem.get(assignment.listItemId);
      if (!recipeId) continue;
      totals.set(recipeId, (totals.get(recipeId) ?? 0) + assignment.price);
    }
    return totals;
  }, [includedMatches, itemAssignments]);

  // Staple summary is computed from the full, unfiltered match set (independent of the
  // toggle) so the "Vaste producten" card always shows what's in the list, not what's
  // currently priced -- same honest-gap rule as ListSummary.bestSingleStoreTotal: only a
  // full-coverage single store earns a headline price.
  const stapleMatches = useMemo(() => matches.filter((match) => match.sourceType === 'staple'), [matches]);
  const stapleOptimizerItems = useMemo(() => toOptimizerItems(stapleMatches), [stapleMatches]);
  const stapleBestCombo = useMemo(() => bestCombos(stapleOptimizerItems, 1)[0], [stapleOptimizerItems]);
  const staplePrice =
    stapleOptimizerItems.length > 0 && stapleBestCombo?.coveredCount === stapleOptimizerItems.length
      ? stapleBestCombo.total
      : undefined;

  const manualItems = useMemo(() => matches.filter((match) => match.sourceType === 'manual'), [matches]);

  // Grouped so each recipe's expandable row can list its own ingredients without a
  // separate query -- matches already carries name/quantity/unit per item.
  const recipeIngredients = useMemo(() => {
    const map = new Map<string, typeof matches>();
    for (const match of matches) {
      if (match.sourceType !== 'recipe' || !match.recipeId) continue;
      const existing = map.get(match.recipeId) ?? [];
      existing.push(match);
      map.set(match.recipeId, existing);
    }
    return map;
  }, [matches]);

  return {
    hasItems: matches.length > 0,
    combos,
    storesBySlug,
    optimizerItems,
    itemPrices,
    recipePrices,
    recipeIngredients,
    stapleItems: stapleMatches,
    staplePrice,
    manualItems,
  };
}

export default function ListHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: list, isLoading, isError } = useListQuery(id);
  const matchMutation = useMatchListItemsMutation();
  const commitMutation = useCommitSelectionMutation();
  const renameMutation = useRenameListMutation();
  const setIncludeStaplesMutation = useSetIncludeStaplesMutation();
  const addManualItemMutation = useAddManualItemMutation();
  const removeListItemMutation = useRemoveListItemMutation();
  const matchTriggeredForListRef = useRef<string | null>(null);
  const matchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    hasItems,
    combos,
    storesBySlug,
    optimizerItems,
    itemPrices,
    recipePrices,
    recipeIngredients,
    stapleItems,
    staplePrice,
    manualItems,
  } = useStoreComparison(id, list?.includeStaples ?? true);
  const [selectedCount, setSelectedCount] = useState('1');
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isStaplesExpanded, setIsStaplesExpanded] = useState(false);
  const [expandedRecipeIds, setExpandedRecipeIds] = useState<Set<string>>(new Set());
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  function toggleRecipeExpanded(recipeId: string) {
    setExpandedRecipeIds((current) => {
      const next = new Set(current);
      if (next.has(recipeId)) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });
  }

  useEffect(() => () => {
    if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
  }, []);

  // Adding several loose products in a row (see "Losse producten" below) should only
  // trigger match_list_items once, not once per product -- debounce instead of
  // re-matching on every single insert/delete.
  function scheduleMatch() {
    if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
    matchDebounceRef.current = setTimeout(() => {
      matchMutation.mutate(id, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list-item-matches', id] }),
      });
    }, 900);
  }

  function handleAddManualProduct() {
    const name = newProductName.trim();
    if (!name) return;
    setNewProductName('');
    addManualItemMutation.mutate({ listId: id, name }, { onSuccess: scheduleMatch });
  }

  function handleRemoveManualProduct(itemId: string) {
    removeListItemMutation.mutate({ id: itemId, listId: id }, { onSuccess: scheduleMatch });
  }

  function startRenaming() {
    if (!list) return;
    setNameDraft(list.name);
    setIsRenaming(true);
  }

  function submitRename() {
    const name = nameDraft.trim();
    if (name && list && name !== list.name) renameMutation.mutate({ id: list.id, name });
    setIsRenaming(false);
  }

  const selectedCombo = combos.find((combo) => String(combo.storeCount) === selectedCount) ?? combos[0];
  const singleStoreTotal = combos[0]?.total;
  const saving =
    selectedCombo && singleStoreTotal !== undefined && selectedCombo.storeCount > 1 && selectedCombo.coveredCount >= combos[0].coveredCount
      ? singleStoreTotal - selectedCombo.total
      : 0;

  function handleStartShopping() {
    if (!selectedCombo) return;
    commitMutation.mutate(
      {
        listId: id,
        combo: selectedCombo,
        items: optimizerItems,
        baselineSingleStoreTotal: singleStoreTotal ?? null,
      },
      {
        onSuccess: () => {
          setIsCompareOpen(false);
          router.push({ pathname: '/shop/[id]', params: { id, listName: list?.name ?? '' } });
        },
      }
    );
  }

  // hasItems, not list.recipes.length -- a staple- or manual-product-only list (no
  // recipe yet) still needs its items matched/priced to reach Compare.
  useEffect(() => {
    if (!list || !hasItems) return;
    if (matchTriggeredForListRef.current === list.id) return;
    matchTriggeredForListRef.current = list.id;
    matchMutation.mutate(list.id, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list-item-matches', list.id] }),
    });
  }, [list, hasItems, matchMutation, queryClient]);

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

        {isLoading && (
          <View style={styles.section}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        )}
        {isError && <ThemedText themeColor="textSecondary">{t.review.commitError}</ThemedText>}

        {list && (
          <>
            <View style={styles.titleBlock}>
              {isRenaming ? (
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  autoFocus
                  onSubmitEditing={submitRename}
                  onBlur={submitRename}
                  style={[styles.titleInput, { color: theme.text }]}
                />
              ) : (
                <Pressable onPress={startRenaming} style={styles.titleRow}>
                  <ThemedText type="title">{list.name}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.pencil}>
                    ✎
                  </ThemedText>
                </Pressable>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {t.home.recipesCount(list.recipes.length)} · {t.lists.createdOn(formatListDate(list.createdAt, locale))}
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t.listHub.recipesInList.toUpperCase()}
              </ThemedText>
              {list.recipes.map((recipe) => {
                const ingredients = recipeIngredients.get(recipe.id) ?? [];
                const price = recipePrices.get(recipe.id);
                return (
                  <Expandable
                    key={recipe.id}
                    expanded={expandedRecipeIds.has(recipe.id)}
                    onToggle={() => toggleRecipeExpanded(recipe.id)}
                    header={
                      <>
                        <View style={[styles.itemIcon, { backgroundColor: theme.backgroundElement }]}>
                          <ThemedText>🍽️</ThemedText>
                        </View>
                        <View style={styles.itemText}>
                          <ThemedText type="smallBold" numberOfLines={1}>
                            {recipe.name}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                            {t.listHub.servingsAndIngredients(recipe.servingsTarget, recipe.itemCount)}
                          </ThemedText>
                        </View>
                        {price !== undefined && <PriceText amount={price} />}
                      </>
                    }>
                    {ingredients.map((item) => (
                      <ListItemRow
                        key={item.listItemId}
                        name={item.name}
                        quantity={item.quantity}
                        unit={item.unit}
                        price={itemPrices.get(item.listItemId)}
                      />
                    ))}
                  </Expandable>
                );
              })}
              <Pressable
                onPress={() => router.push({ pathname: '/capture', params: { listId: list.id, listName: list.name } })}
                style={[styles.addRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" style={{ color: theme.chipCheapestBg }}>
                  + {t.listHub.addRecipe}
                </ThemedText>
              </Pressable>
            </View>

            {stapleItems.length > 0 && (
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t.listHub.staplesInList.toUpperCase()}
                </ThemedText>
                <Expandable
                  expanded={isStaplesExpanded}
                  onToggle={() => setIsStaplesExpanded((expanded) => !expanded)}
                  header={
                    <>
                      <View style={[styles.itemIcon, { backgroundColor: theme.backgroundElement }]}>
                        <ProductIcon category="other" color={theme.textSecondary} />
                      </View>
                      <View style={styles.itemText}>
                        <ThemedText type="smallBold" numberOfLines={1}>
                          {t.listHub.staplesInList}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                          {t.listHub.staplesCount(stapleItems.length)}
                        </ThemedText>
                      </View>
                    </>
                  }
                  trailing={
                    <>
                      {list.includeStaples && staplePrice !== undefined && <PriceText amount={staplePrice} />}
                      <Toggle
                        value={list.includeStaples}
                        onValueChange={(includeStaples) => setIncludeStaplesMutation.mutate({ id: list.id, includeStaples })}
                      />
                    </>
                  }>
                  {stapleItems.map((item) => (
                    <ListItemRow
                      key={item.listItemId}
                      name={item.name}
                      quantity={item.quantity}
                      unit={item.unit}
                      price={itemPrices.get(item.listItemId)}
                    />
                  ))}
                </Expandable>
              </View>
            )}

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t.listHub.manualProducts.toUpperCase()}
              </ThemedText>
              {manualItems.map((item) => (
                <ListItemRow
                  key={item.listItemId}
                  name={item.name}
                  quantity={item.quantity}
                  unit={item.unit}
                  price={itemPrices.get(item.listItemId)}
                  onRemove={() => handleRemoveManualProduct(item.listItemId)}
                />
              ))}
              {isAddingProduct ? (
                <View style={[styles.addRow, styles.addRowActive, { borderColor: theme.backgroundSelected }]}>
                  <TextInput
                    value={newProductName}
                    onChangeText={setNewProductName}
                    placeholder={t.listHub.addProduct}
                    placeholderTextColor={theme.textSecondary}
                    autoFocus
                    blurOnSubmit={false}
                    onSubmitEditing={handleAddManualProduct}
                    onBlur={() => {
                      if (!newProductName.trim()) setIsAddingProduct(false);
                    }}
                    style={[styles.addInput, { color: theme.text }]}
                  />
                </View>
              ) : (
                <Pressable
                  onPress={() => setIsAddingProduct(true)}
                  style={[styles.addRow, { borderColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold" style={{ color: theme.chipCheapestBg }}>
                    + {t.listHub.addProduct}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {hasItems && selectedCombo ? (
              <EntityCard
                icon={<ThemedText>🛒</ThemedText>}
                title={t.listHub.compareStores}
                subtitle={t.lists.fromOneStore}
                price={combos[0]?.total}
                onPress={() => setIsCompareOpen(true)}
              />
            ) : (
              <HonestGapCard
                title={t.listHub.pricingComingSoonTitle}
                subtitle={t.listHub.pricingComingSoonSubtitle}
              />
            )}
          </>
        )}
      </View>

      {hasItems && selectedCombo && (
        <Modal visible={isCompareOpen} animationType="slide" transparent onRequestClose={() => setIsCompareOpen(false)}>
          <View style={styles.sheetBackdrop}>
            {/* Sibling touch-catcher behind the sheet, not a Pressable wrapping it --
                see dialog.tsx for why nesting the sheet inside the backdrop's own
                Pressable can eat taps meant for controls inside. */}
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsCompareOpen(false)} />
            <View pointerEvents="box-none">
              <ThemedView style={styles.sheet}>
                <View style={styles.sheetHeader}>
                  <ThemedText type="subtitle">{t.listHub.compareStores}</ThemedText>
                  <Pressable onPress={() => setIsCompareOpen(false)} hitSlop={Spacing.two}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      ✕
                    </ThemedText>
                  </Pressable>
                </View>

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
                        return store ? (
                          <StoreChip key={slug} slug={store.slug} displayName={store.displayName} monogram={store.monogram} isCheapest size={34} />
                        ) : null;
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

                <TotalBanner
                  ctaLabel={t.listHub.startShopping}
                  amount={selectedCombo.total}
                  onPress={handleStartShopping}
                  disabled={commitMutation.isPending}
                />
              </ThemedView>
            </View>
          </View>
        </Modal>
      )}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pencil: {
    fontSize: 16,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleInput: {
    fontFamily: Fonts.display.bold,
    fontSize: 48,
    lineHeight: 52,
    padding: 0,
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
  addRowActive: {
    borderStyle: 'solid',
    paddingHorizontal: Spacing.three,
  },
  addInput: {
    fontSize: 15,
    fontWeight: '700',
    width: '100%',
    textAlign: 'center',
    padding: 0,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20, 17, 12, 0.5)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
