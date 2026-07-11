import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Dialog } from '@/components/ui/dialog';
import { ProductIcon, matchProductCategory } from '@/components/ui/product-icon';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Stepper } from '@/components/ui/stepper';
import { TabScreenTransition } from '@/components/ui/tab-screen-transition';
import {
  useAddStapleTemplateMutation,
  useDeleteStapleTemplateMutation,
  useStapleTemplatesQuery,
  useUpdateStapleQuantityMutation,
  useUpdateStapleUnitMutation,
  type StapleTemplate,
} from '@/features/staples/api';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

export default function StaplesScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const { t } = useTranslation();
  const { data: staples = [], isLoading, isError } = useStapleTemplatesQuery();
  const updateQuantity = useUpdateStapleQuantityMutation();
  const updateUnit = useUpdateStapleUnitMutation();
  const addStaple = useAddStapleTemplateMutation();
  const deleteStaple = useDeleteStapleTemplateMutation();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitDraft, setUnitDraft] = useState('');
  const [pendingRemove, setPendingRemove] = useState<StapleTemplate | null>(null);

  const submitNewStaple = () => {
    const name = newName.trim();
    if (!name) {
      setIsAdding(false);
      setNewUnit('');
      return;
    }
    addStaple.mutate({ name, unit: newUnit.trim() || null });
    setNewName('');
    setNewUnit('');
    setIsAdding(false);
  };

  function startEditingUnit(item: StapleTemplate) {
    setEditingUnitId(item.id);
    setUnitDraft(item.unit ?? '');
  }

  function submitUnitEdit(item: StapleTemplate) {
    const unit = unitDraft.trim() || null;
    if (unit !== item.unit) updateUnit.mutate({ id: item.id, unit });
    setEditingUnitId(null);
  }

  // Dialing the stepper down to 0 asks for confirmation instead of silently
  // soft-disabling forever -- a real delete, not just quantity 0 (see
  // useDeleteStapleTemplateMutation for why that's safe for historical lists).
  function confirmRemove(item: StapleTemplate) {
    setPendingRemove(item);
  }

  // See index.tsx for why iOS now needs explicit padding (headless tab bar, no
  // more NativeTabs auto content-inset-adjustment).
  const contentPlatformStyle = Platform.select({
    ios: { paddingTop: insets.top, paddingBottom: insets.bottom },
    android: { paddingTop: insets.top, paddingBottom: insets.bottom },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  return (
    <TabScreenTransition routeIndex={2}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
      >
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <ThemedText type="title">{t.staples.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.staples.subtitle}
            </ThemedText>
          </View>

          {isError && <ThemedText themeColor="textSecondary">{t.review.commitError}</ThemedText>}

          {isLoading && (
            <View style={styles.list}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          )}

          <View style={styles.list}>
            {staples.map((item) => {
              const isOff = item.quantity === 0;
              return (
                // No per-item price here: staple_templates has no price column (that would
                // need the same catalog-matching machinery list_items gets), so this stays
                // honest rather than fabricating one. The icon is a best-effort keyword
                // match to a category (matchProductCategory), not real product data.
                <ThemedView key={item.id} type="backgroundElement" style={[styles.card, isOff && styles.cardOff]}>
                  <View style={[styles.iconTile, { backgroundColor: theme.backgroundSelected }]}>
                    <ProductIcon category={matchProductCategory(item.name)} color={theme.textSecondary} />
                  </View>
                  <View style={styles.cardBody}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    {isOff ? (
                      <Pressable onPress={() => confirmRemove(item)} hitSlop={Spacing.one}>
                        <ThemedText type="small" style={{ color: theme.honestGapBorder }}>
                          {t.staples.remove}
                        </ThemedText>
                      </Pressable>
                    ) : editingUnitId === item.id ? (
                      <TextInput
                        value={unitDraft}
                        onChangeText={setUnitDraft}
                        placeholder={t.staples.unitPlaceholder}
                        placeholderTextColor={theme.textSecondary}
                        autoFocus
                        onSubmitEditing={() => submitUnitEdit(item)}
                        onBlur={() => submitUnitEdit(item)}
                        style={[styles.unitInput, { color: theme.text }]}
                      />
                    ) : (
                      <Pressable onPress={() => startEditingUnit(item)} hitSlop={Spacing.one}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {item.unit || t.staples.unitHint}
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                  <Stepper
                    value={item.quantity}
                    onChange={(quantity) => (quantity === 0 ? confirmRemove(item) : updateQuantity.mutate({ id: item.id, quantity }))}
                    min={0}
                    max={99}
                  />
                </ThemedView>
              );
            })}

            {isAdding ? (
              <View style={[styles.addRow, styles.addRowActive, { borderColor: theme.backgroundSelected }]}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder={t.staples.addProduct}
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                  onSubmitEditing={submitNewStaple}
                  style={[styles.addInput, { color: theme.text }]}
                />
                <TextInput
                  value={newUnit}
                  onChangeText={setNewUnit}
                  placeholder={t.staples.unitPlaceholder}
                  placeholderTextColor={theme.textSecondary}
                  onSubmitEditing={submitNewStaple}
                  onBlur={submitNewStaple}
                  style={[
                    styles.addUnitInput,
                    {
                      color: theme.text,
                      borderColor: theme.backgroundSelected,
                    },
                  ]}
                />
              </View>
            ) : (
              <Pressable onPress={() => setIsAdding(true)} style={[styles.addRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  + {t.staples.addProduct}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>
      </ScrollView>

      <Dialog
        visible={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        title={pendingRemove ? t.staples.removeTitle(pendingRemove.name) : ''}
        message={t.staples.removeMessage}
        actions={[
          { label: t.staples.cancel, onPress: () => setPendingRemove(null) },
          {
            label: t.staples.remove,
            variant: 'fix-it',
            onPress: () => {
              if (pendingRemove) deleteStaple.mutate(pendingRemove.id);
              setPendingRemove(null);
            },
          },
        ]}
      />
    </TabScreenTransition>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    width: '100%',
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  header: { gap: Spacing.two },
  list: { gap: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
  },
  cardOff: { opacity: 0.55 },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: Spacing.half },
  addRow: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRowActive: {
    flexDirection: 'row',
    borderStyle: 'solid',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  addInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
  },
  addUnitInput: {
    minWidth: 64,
    fontSize: 15,
    fontWeight: '700',
    borderLeftWidth: 1,
    paddingLeft: Spacing.two,
  },
  unitInput: {
    fontSize: 13,
    padding: 0,
    minWidth: 60,
  },
});
