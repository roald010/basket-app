import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/ui/stepper';
import { clearDraft, getDraft, type DraftIngredient } from '@/features/capture/draft-store';
import { useCommitRecipeMutation } from '@/features/recipes/api';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

/** Stable client-side id so deleting a row mid-edit doesn't shift React's key
 * assignment (and with it, focus) for every row after it. `base` is the amount as the
 * recipe is written (per its own serving count); the displayed `quantity` is `base`
 * scaled to the cook-for count. */
type ReviewIngredient = DraftIngredient & { id: number; base: number | null };

const round2 = (value: number) => Math.round(value * 100) / 100;

export default function ReviewScreen() {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const commitRecipe = useCommitRecipeMutation();
  const [error, setError] = useState<string | null>(null);

  const draft = getDraft();

  // The edge function already scaled quantities to the initial cook-for count. Divide
  // that back out to recover the as-written amount per the recipe's own serving count:
  // base = scaled * source / initialTarget. This cancels cleanly even when the detected
  // source is wrong (both the scale-up and this scale-down use the same source), so the
  // recipe-serving stepper below can correct a bad detection and re-scale accurately.
  const initialSource = Math.max(1, draft?.servingsSource ?? 1);
  const initialTarget = Math.max(1, draft?.servingsTarget ?? 2);

  const [ingredients, setIngredients] = useState<ReviewIngredient[]>(
    () =>
      draft?.ingredients.map((ingredient, index) => ({
        ...ingredient,
        id: index,
        base: ingredient.quantity === null ? null : round2((ingredient.quantity * initialSource) / initialTarget),
      })) ?? []
  );
  const [recipeServings, setRecipeServings] = useState(initialSource);
  const [cookServings, setCookServings] = useState(initialTarget);
  const nextId = useRef(ingredients.length);

  // No draft (e.g. deep-linked directly, or a stale reload) -- nothing to review.
  useEffect(() => {
    if (!draft) router.back();
  }, [draft]);

  if (!draft) return null;

  const updateIngredient = (id: number, patch: Partial<DraftIngredient>) => {
    setIngredients((current) =>
      current.map((ingredient) => (ingredient.id === id ? { ...ingredient, ...patch, isManuallyEdited: true } : ingredient))
    );
  };

  const removeIngredient = (id: number) => {
    setIngredients((current) => current.filter((ingredient) => ingredient.id !== id));
  };

  const addIngredient = () => {
    setIngredients((current) => [
      ...current,
      { id: nextId.current++, name: '', quantity: null, unit: '', isManuallyEdited: true, base: null },
    ]);
  };

  // Both serving counts re-derive every non-edited quantity from its immutable `base`.
  // Manually-typed rows are left alone -- a hand-entered amount is intentional.
  const rescale = (recipe: number, cook: number) => {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.isManuallyEdited || ingredient.base === null
          ? ingredient
          : { ...ingredient, quantity: round2((ingredient.base * cook) / recipe) }
      )
    );
  };

  const changeRecipeServings = (next: number) => {
    if (next <= 0 || next === recipeServings) return;
    rescale(next, cookServings);
    setRecipeServings(next);
  };

  const changeCookServings = (next: number) => {
    if (next <= 0 || next === cookServings) return;
    rescale(recipeServings, next);
    setCookServings(next);
  };

  const listName = draft.listName ?? t.capture.newListDefaultName;
  const showScaledNote = recipeServings !== cookServings;

  const onCommit = () => {
    setError(null);
    commitRecipe.mutate(
      {
        listId: draft.listId,
        locale,
        title: draft.title,
        originalText: draft.originalText,
        servingsSource: recipeServings,
        servingsTarget: cookServings,
        ingredients,
      },
      {
        onSuccess: ({ listId }) => {
          clearDraft();
          router.replace(`/list/${listId}`);
        },
        onError: () => setError(t.review.commitError),
      }
    );
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.four }}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={Spacing.two}>
          <ThemedText type="smallBold">‹</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.dismiss()} hitSlop={Spacing.two}>
          <ThemedText type="smallBold">✕</ThemedText>
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <ThemedText type="small" themeColor="textSecondary">
          {t.review.stepLabel}
        </ThemedText>
        <ThemedText type="subtitle">{t.review.ingredientsFound(ingredients.length)}</ThemedText>
      </View>

      <View style={styles.servingsWrap}>
        <View style={[styles.servingsCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
          <View style={styles.servingsRow}>
            <ThemedText type="smallBold" style={styles.servingsLabel}>
              {t.review.servingsRecipeLabel}
            </ThemedText>
            <Stepper value={recipeServings} onChange={changeRecipeServings} min={1} max={20} />
          </View>
          <View style={[styles.servingsDivider, { backgroundColor: theme.backgroundElement }]} />
          <View style={styles.servingsRow}>
            <ThemedText type="smallBold" style={styles.servingsLabel}>
              {t.review.servingsTargetLabel}
            </ThemedText>
            <Stepper value={cookServings} onChange={changeCookServings} min={1} max={20} />
          </View>
        </View>
        {showScaledNote && (
          <ThemedText type="small" style={[styles.scaledNote, { color: theme.chipCheapestBg }]}>
            {t.review.servingsScaledNote(recipeServings, cookServings)}
          </ThemedText>
        )}
      </View>

      <View style={styles.list}>
        {ingredients.map((ingredient) => (
          <View
            key={ingredient.id}
            style={[
              styles.row,
              {
                backgroundColor: ingredient.isManuallyEdited ? theme.chipCheapestBg + '1a' : theme.background,
                borderColor: ingredient.isManuallyEdited ? theme.chipCheapestBg : theme.backgroundElement,
              },
            ]}>
            <View style={styles.rowFields}>
              <View style={styles.rowNameLine}>
                <TextInput
                  value={ingredient.name}
                  onChangeText={(name) => updateIngredient(ingredient.id, { name })}
                  placeholder={t.review.namePlaceholder}
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.nameInput, { color: theme.text }]}
                />
                {ingredient.isManuallyEdited && (
                  <View style={[styles.editedBadge, { backgroundColor: theme.chipCheapestBg }]}>
                    <ThemedText type="small" style={{ color: theme.chipCheapestText, fontSize: 10 }}>
                      {t.review.edited}
                    </ThemedText>
                  </View>
                )}
              </View>
              <View style={styles.rowQtyLine}>
                <View style={[styles.qtyBox, { backgroundColor: theme.backgroundElement }]}>
                  <TextInput
                    value={ingredient.quantity === null ? '' : String(ingredient.quantity)}
                    onChangeText={(value) => updateIngredient(ingredient.id, { quantity: value === '' ? null : Number(value) })}
                    placeholder={t.review.quantityPlaceholder}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    style={[styles.qtyInput, { color: theme.text }]}
                  />
                </View>
                <View style={[styles.unitBox, { backgroundColor: theme.backgroundElement }]}>
                  <TextInput
                    value={ingredient.unit}
                    onChangeText={(unit) => updateIngredient(ingredient.id, { unit })}
                    placeholder={t.review.unitPlaceholder}
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.unitInput, { color: theme.text }]}
                  />
                </View>
              </View>
            </View>
            <Pressable onPress={() => removeIngredient(ingredient.id)} hitSlop={Spacing.two}>
              <ThemedText themeColor="textSecondary">✕</ThemedText>
            </Pressable>
          </View>
        ))}

        <Pressable onPress={addIngredient} style={styles.addRow}>
          <ThemedText type="smallBold" style={{ color: theme.chipCheapestBg }}>
            + {t.review.addIngredient}
          </ThemedText>
        </Pressable>
      </View>

      {error && (
        <ThemedText type="small" style={[styles.error, { color: theme.honestGapBorder }]}>
          {error}
        </ThemedText>
      )}

      <View style={styles.footer}>
        <Button
          label={commitRecipe.isPending ? t.review.committing : t.review.commit(listName)}
          variant="primary-green"
          onPress={onCommit}
          disabled={commitRecipe.isPending}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  titleBlock: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  servingsWrap: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  servingsCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  servingsLabel: {
    flex: 1,
    minWidth: 0,
  },
  servingsDivider: {
    height: 1,
  },
  scaledNote: {
    paddingHorizontal: Spacing.one,
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: 15,
    padding: Spacing.three,
  },
  rowFields: {
    flex: 1,
    gap: Spacing.half,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
  },
  editedBadge: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rowQtyLine: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: 2,
  },
  qtyBox: {
    minWidth: 44,
    borderRadius: 8,
    paddingHorizontal: Spacing.one,
    paddingVertical: 3,
  },
  qtyInput: {
    fontSize: 12.5,
    fontWeight: '700',
    padding: 0,
    textAlign: 'center',
  },
  unitBox: {
    minWidth: 52,
    borderRadius: 8,
    paddingHorizontal: Spacing.one,
    paddingVertical: 3,
  },
  unitInput: {
    fontSize: 12.5,
    fontWeight: '700',
    padding: 0,
    textAlign: 'center',
  },
  addRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
  },
  error: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  footer: {
    padding: Spacing.four,
  },
});
