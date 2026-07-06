import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StoreChip } from '@/components/ui/store-chip';
import { Toggle } from '@/components/ui/toggle';
import { BottomTabInset, BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

type Tier = 'budget' | 'balans' | 'premium';

const EXAMPLE_OPTIONS: { tier: Tier; name: string; price: string }[] = [
  { tier: 'budget', name: 'Basic geraspt', price: '€1,29' },
  { tier: 'balans', name: 'Pecorino geraspt', price: '€2,49' },
  { tier: 'premium', name: 'Pecorino DOP', price: '€4,79' },
];

const MY_STORES = [
  { monogram: 'AH', name: 'Albert Heijn' },
  { monogram: 'Ju', name: 'Jumbo' },
  { monogram: 'Pl', name: 'Plus' },
];

const NEARBY_STORES = [
  { monogram: 'Di', name: 'Dirk' },
  { monogram: 'Li', name: 'Lidl' },
];

export default function ProfileScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const { t } = useTranslation();
  const [tier, setTier] = useState<Tier>('balans');

  const contentPlatformStyle = Platform.select({
    android: { paddingTop: insets.top, paddingBottom: insets.bottom },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  const tierLabel: Record<Tier, string> = {
    budget: t.profile.tierBudget,
    balans: t.profile.tierBalans,
    premium: t.profile.tierPremium,
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">{t.profile.title}</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {}}
            style={[styles.gearButton, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="default" themeColor="textSecondary">
              ⚙
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            {t.profile.shopperProfile}
          </ThemedText>
          <SegmentedControl
            options={[
              { value: 'budget', label: t.profile.tierBudget },
              { value: 'balans', label: t.profile.tierBalans },
              { value: 'premium', label: t.profile.tierPremium },
            ]}
            value={tier}
            onChange={(value) => setTier(value as Tier)}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t.profile.tierExplain}
          </ThemedText>

          <View style={[styles.exampleCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{t.profile.exampleFor('Pecorino Romano')}</ThemedText>
            <View style={styles.optionRow}>
              {EXAMPLE_OPTIONS.map((option) => {
                const active = option.tier === tier;
                return (
                  <View
                    key={option.tier}
                    style={[
                      styles.optionTile,
                      { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
                      active && {
                        borderColor: BrandColors.green,
                        backgroundColor: theme.chipCheapestBg,
                      },
                      !active && styles.optionTileInactive,
                    ]}>
                    <View style={styles.optionTierRow}>
                      <ThemedText
                        type="small"
                        style={[
                          styles.optionTierLabel,
                          { color: active ? theme.chipCheapestText : theme.textSecondary },
                        ]}>
                        {tierLabel[option.tier].toUpperCase()}
                      </ThemedText>
                      {active ? (
                        <ThemedText type="small" style={{ color: theme.chipCheapestText }}>
                          ✓
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText
                      type="smallBold"
                      style={active ? { color: theme.chipCheapestText } : undefined}
                      numberOfLines={2}>
                      {option.name}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      tabularNums
                      style={active ? { color: theme.chipCheapestText } : undefined}>
                      {option.price}
                    </ThemedText>
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
            {MY_STORES.map((store) => (
              <View
                key={store.monogram}
                style={[
                  styles.storePill,
                  { backgroundColor: theme.chipCheapestBg, borderColor: BrandColors.green },
                ]}>
                <StoreChip monogram={store.monogram} isCheapest size={24} />
                <ThemedText type="smallBold" style={{ color: theme.chipCheapestText }}>
                  {store.name}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.chipCheapestText }}>
                  ✓
                </ThemedText>
              </View>
            ))}
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {t.profile.nearby}
          </ThemedText>
          <View style={styles.chipRow}>
            {NEARBY_STORES.map((store) => (
              <Pressable
                key={store.monogram}
                accessibilityRole="button"
                onPress={() => {}}
                style={[styles.storePillOutline, { borderColor: theme.backgroundSelected }]}>
                <StoreChip monogram={store.monogram} size={24} />
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {store.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  +
                </ThemedText>
              </Pressable>
            ))}
          </View>
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
  section: { gap: Spacing.three },
  sectionLabel: { letterSpacing: 0.5 },
  exampleCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  optionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  optionTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  optionTileInactive: {
    opacity: 0.6,
  },
  optionTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
