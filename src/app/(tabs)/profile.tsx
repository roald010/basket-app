import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StoreChip } from '@/components/ui/store-chip';
import { TabScreenTransition } from '@/components/ui/tab-screen-transition';
import { Toggle } from '@/components/ui/toggle';
import { useProfileQuery, useUpdateShopperTierMutation, type ShopperTier } from '@/features/profile/api';
import { useStoresQuery } from '@/features/stores/api';
import { useAddUserStoreMutation, useRemoveUserStoreMutation, useUserStoresQuery } from '@/features/stores/user-stores-api';
import { BottomTabInset, BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation, type Locale } from '@/i18n';

const EXAMPLE_OPTIONS: { tier: ShopperTier; name: string; price: string }[] = [
  { tier: 'budget', name: 'Basic geraspt', price: '€1,29' },
  { tier: 'balans', name: 'Pecorino geraspt', price: '€2,49' },
  { tier: 'premium', name: 'Pecorino DOP', price: '€4,79' },
];

export default function ProfileScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const { t, locale, setLocale } = useTranslation();
  const { data: profile } = useProfileQuery();
  const updateTier = useUpdateShopperTierMutation();
  const { data: allStores = [] } = useStoresQuery();
  const { data: myStores = [] } = useUserStoresQuery();
  const addUserStore = useAddUserStoreMutation();
  const removeUserStore = useRemoveUserStoreMutation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const tier = profile?.shopperTier ?? 'balans';
  const myChainSlugs = new Set(myStores.map((store) => store.chainSlug));
  const nearbyStores = allStores.filter((store) => !myChainSlugs.has(store.slug));

  // See (tabs)/index.tsx for why iOS now needs explicit padding (headless tab
  // bar, no more NativeTabs auto content-inset-adjustment).
  const contentPlatformStyle = Platform.select({
    ios: { paddingTop: insets.top, paddingBottom: insets.bottom },
    android: { paddingTop: insets.top, paddingBottom: insets.bottom },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  const tierLabel: Record<ShopperTier, string> = {
    budget: t.profile.tierBudget,
    balans: t.profile.tierBalans,
    premium: t.profile.tierPremium,
  };

  return (
    <TabScreenTransition routeIndex={3}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
      >
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <ThemedText type="title">{t.profile.title}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsSettingsOpen(true)}
              style={[styles.gearButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="default" themeColor="textSecondary">
                ⚙
              </ThemedText>
            </Pressable>
          </View>

          <Modal visible={isSettingsOpen} animationType="slide" transparent onRequestClose={() => setIsSettingsOpen(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setIsSettingsOpen(false)}>
              <Pressable onPress={(e) => e.stopPropagation()}>
                <ThemedView style={styles.modalSheet}>
                  <View style={styles.modalHeader}>
                    <ThemedText type="subtitle">{t.settings.title}</ThemedText>
                    <Pressable onPress={() => setIsSettingsOpen(false)} hitSlop={Spacing.two}>
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        ✕
                      </ThemedText>
                    </Pressable>
                  </View>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                    {t.settings.language}
                  </ThemedText>
                  <SegmentedControl
                    options={[
                      { value: 'nl', label: 'Nederlands' },
                      { value: 'en', label: 'English' },
                    ]}
                    value={locale}
                    onChange={(value) => setLocale(value as Locale)}
                  />
                </ThemedView>
              </Pressable>
            </Pressable>
          </Modal>

          <View style={styles.section}>
            <View
              style={[
                styles.pickerCard,
                { backgroundColor: theme.chipCheapestBg + '14', borderColor: BrandColors.green },
              ]}
            >
              <ThemedText type="smallBold" style={styles.sectionLabel}>
                {t.profile.shopperProfile}
              </ThemedText>
              <SegmentedControl
                options={[
                  { value: 'budget', label: t.profile.tierBudget },
                  { value: 'balans', label: t.profile.tierBalans },
                  { value: 'premium', label: t.profile.tierPremium },
                ]}
                value={tier}
                onChange={(value) => updateTier.mutate(value as ShopperTier)}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {t.profile.tierExplain}
              </ThemedText>
            </View>

            {/* Deliberately flat/non-tappable-looking (no per-column borders or fills like
                the picker above) -- this is a read-only illustration of the current pick,
                not a second control, so it must never read as its own set of buttons. */}
            <View style={[styles.exampleCard, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.exampleBadge, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.exampleBadgeText}>
                  {t.profile.exampleBadge}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {t.profile.exampleFor('Pecorino Romano')}
              </ThemedText>
              <View style={styles.optionRow}>
                {EXAMPLE_OPTIONS.map((option, index) => {
                  const active = option.tier === tier;
                  return (
                    <View
                      key={option.tier}
                      style={[
                        styles.optionColumn,
                        index > 0 && { borderLeftWidth: 1, borderLeftColor: theme.backgroundSelected },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={[styles.optionTierLabel, { color: active ? theme.text : theme.textSecondary }]}
                      >
                        {tierLabel[option.tier].toUpperCase()}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={active ? styles.optionNameActive : { color: theme.textSecondary }}
                        numberOfLines={2}
                      >
                        {option.name}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        tabularNums
                        style={active ? [styles.optionNameActive, { color: BrandColors.green }] : { color: theme.textSecondary }}
                      >
                        {option.price}
                      </ThemedText>
                      {active && (
                        <ThemedText type="small" style={{ color: BrandColors.green }}>
                          {t.profile.yourPick}
                        </ThemedText>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              {t.profile.myStores}
            </ThemedText>
            <View style={styles.chipRow}>
              {myStores.map((store) => (
                <Pressable
                  key={store.chainSlug}
                  accessibilityRole="button"
                  onPress={() => removeUserStore.mutate(store.chainSlug)}
                  style={[
                    styles.storePill,
                    {
                      backgroundColor: theme.chipCheapestBg,
                      borderColor: BrandColors.green,
                    },
                  ]}
                >
                  <StoreChip slug={store.chainSlug} displayName={store.displayName} monogram={store.monogram} isCheapest size={24} />
                  <ThemedText type="smallBold" style={{ color: theme.chipCheapestText }}>
                    {store.displayName}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.chipCheapestText }}>
                    ✕
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {nearbyStores.length > 0 && (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  {t.profile.nearby}
                </ThemedText>
                <View style={styles.chipRow}>
                  {nearbyStores.map((store) => (
                    <Pressable
                      key={store.slug}
                      accessibilityRole="button"
                      onPress={() => addUserStore.mutate(store.slug)}
                      style={[styles.storePillOutline, { borderColor: theme.backgroundSelected }]}
                    >
                      <StoreChip slug={store.slug} displayName={store.displayName} monogram={store.monogram} size={24} />
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        {store.displayName}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        +
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={[styles.alternativesRow, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.alternativesText}>
              <View style={styles.alternativesTitleRow}>
                <ThemedText type="smallBold">{t.profile.openToAlternatives}</ThemedText>
                <View style={[styles.comingSoonBadge, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.comingSoonText}>
                    {t.profile.comingSoon}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {t.profile.openToAlternativesSubtitle}
              </ThemedText>
            </View>
            <Toggle value={false} disabled />
          </View>
        </ThemedView>
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20, 17, 12, 0.5)',
  },
  modalSheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: { gap: Spacing.three },
  sectionLabel: { letterSpacing: 0.5 },
  pickerCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  exampleCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  exampleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 2,
  },
  exampleBadgeText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  optionRow: {
    flexDirection: 'row',
  },
  optionColumn: {
    flex: 1,
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  optionNameActive: {
    fontWeight: '700',
  },
  optionTierLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.three,
  },
  storePillOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.three,
  },
  alternativesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 16,
    padding: Spacing.three,
  },
  alternativesText: {
    flex: 1,
    gap: Spacing.one,
  },
  alternativesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  comingSoonBadge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  comingSoonText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
