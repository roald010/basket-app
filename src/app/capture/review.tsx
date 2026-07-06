import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { clearDraft, getDraft, type DraftIngredient } from '@/features/capture/draft-store';
import { useCommitRecipeMutation } from '@/features/recipes/api';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

/** Stable client-side id so deleting a row mid-edit doesn't shift React's key
 * assignment (and with it, focus) for every row after it. */
type ReviewIngredient = DraftIngredient & { id: number };

export default function ReviewScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const commitRecipe = useCommitRecipeMutation();
  const [error, setError] = useState<string | null>(null);

  const draft = getDraft();
  const [ingredients, setIngredients] = useState<ReviewIngredient[]>(
    () => draft?.ingredients.map((ingredient, index) => ({ ...ingredient, id: index })) ?? []
  );
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
      { id: nextId.current++, name: '', quantity: null, unit: '', isManuallyEdited: true },
    ]);
  };

  const listName = draft.listName ?? t.capture.newListDefaultName;

  const onCommit = () => {
    setError(null);
    commitRecipe.mutate(
      {
        listId: draft.listId,
        title: draft.title,
        originalText: draft.originalText,
        servingsSource: draft.servingsSource,
        servingsTarget: draft.servingsTarget,
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
        <ThemedText type="smallBold" numberOfLines={1} style={styles.headerTitle}>
          {draft.title} · {draft.servingsTarget}
        </ThemedText>
        <Pressable onPress={() => router.dismiss()} hitSlop={Spacing.two}>
          <ThemedText type="smallBold">✕</ThemedText>
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <ThemedText type="small" themeColor="textSecondary">
          {t.review.stepLabel}
        </ThemedText>
        <ThemedText type="subtitle">{t.review.ingredientsFound(ingredients.length)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t.review.scaledHint(draft.servingsTarget)}
        </ThemedText>
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
                <TextInput
                  value={ingredient.quantity === null ? '' : String(ingredient.quantity)}
                  onChangeText={(value) => updateIngredient(ingredient.id, { quantity: value === '' ? null : Number(value) })}
                  placeholder={t.review.quantityPlaceholder}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  style={[styles.qtyInput, { color: theme.textSecondary }]}
                />
                <TextInput
                  value={ingredient.unit}
                  onChangeText={(unit) => updateIngredient(ingredient.id, { unit })}
                  placeholder={t.review.unitPlaceholder}
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.unitInput, { color: theme.textSecondary }]}
                />
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.two,
  },
  titleBlock: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
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
    gap: Spacing.two,
  },
  qtyInput: {
    fontSize: 12.5,
    padding: 0,
    minWidth: 50,
  },
  unitInput: {
    fontSize: 12.5,
    padding: 0,
    minWidth: 60,
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
