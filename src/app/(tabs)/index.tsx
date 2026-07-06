import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PriceText, formatEUR } from '@/components/ui/price-text';
import { StoreChip } from '@/components/ui/store-chip';
import { BottomTabInset, BrandColors, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

type RecentList = {
  id: string;
  title: string;
  chips: string[];
  recipes: number;
  stores: number;
  price: number;
  savings?: number;
};

const RECENT_LISTS: RecentList[] = [
  { id: 'weekmenu', title: 'Weekmenu', chips: ['AH', 'Ju'], recipes: 2, stores: 2, price: 19.4, savings: -2.4 },
  { id: 'bbq', title: 'Verjaardag BBQ', chips: ['Ju'], recipes: 4, stores: 1, price: 47.3 },
];

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  const contentPlatformStyle = Platform.select({
    android: { paddingTop: insets.top, paddingBottom: insets.bottom },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <ThemedText type="small" themeColor="textSecondary">
              {t.home.greeting('Sanne')}
            </ThemedText>
            <ThemedText type="subtitle">{t.home.title}</ThemedText>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.langChip, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.langGlobe}>🌐</ThemedText>
              <ThemedText type="smallBold" themeColor="textSecondary">
                NL
              </ThemedText>
            </View>
            <View style={[styles.avatar, { backgroundColor: theme.chipNeutralBg }]}>
              <ThemedText type="smallBold" style={[styles.avatarLetter, { color: BrandColors.green }]}>
                S
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.savingsRibbon}>
          <View style={styles.savingsIcon}>
            <ThemedText style={styles.savingsGlyph}>📈</ThemedText>
          </View>
          <View style={styles.savingsText}>
            <ThemedText type="small" style={styles.onGreenMuted}>
              {t.home.savingsLabel('mei')}
            </ThemedText>
            <ThemedText type="subtitle" tabularNums style={styles.savingsAmount}>
              {formatEUR(11.4)}
            </ThemedText>
          </View>
          <Pressable style={styles.seeHow} hitSlop={Spacing.two}>
            <ThemedText type="small" style={styles.onGreenMuted}>
              {t.home.seeHow}
            </ThemedText>
            <ThemedText style={styles.seeHowChevron}>›</ThemedText>
          </Pressable>
        </View>

        <Pressable style={styles.ctaCard} onPress={() => router.push('/capture')}>
          <View style={styles.ctaIcon}>
            <ThemedText style={styles.ctaPlus}>+</ThemedText>
          </View>
          <View style={styles.ctaText}>
            <ThemedText type="smallBold" style={styles.onInk}>
              {t.home.newList}
            </ThemedText>
            <ThemedText type="small" style={styles.onInkMuted}>
              {t.home.newListSubtitle}
            </ThemedText>
          </View>
        </Pressable>

        <View style={styles.sectionHeader}>
          <ThemedText type="smallBold">{t.home.recentLists}</ThemedText>
          <Pressable hitSlop={Spacing.two} onPress={() => router.push('/lists')}>
            <ThemedText type="smallBold" style={styles.link}>
              {t.home.all}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.listStack}>
          {RECENT_LISTS.map((list) => (
            <View key={list.id} style={[styles.listCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
              <View style={[styles.listIcon, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.listGlyph}>🛍️</ThemedText>
              </View>
              <View style={styles.listText}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {list.title}
                </ThemedText>
                <View style={styles.listMeta}>
                  <View style={styles.listChips}>
                    {list.chips.map((chip) => (
                      <StoreChip key={chip} monogram={chip} isCheapest size={22} />
                    ))}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {`${t.home.recipesCount(list.recipes)} · ${t.home.storesCount(list.stores)}`}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.priceColumn}>
                <PriceText amount={list.price} />
                {list.savings !== undefined && <PriceText amount={list.savings} signed type="small" />}
              </View>
            </View>
          ))}
        </View>
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
    paddingVertical: Spacing.five,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    height: 28,
    borderRadius: 14,
  },
  langGlobe: {
    fontSize: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
  },
  savingsRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.green,
    borderRadius: 16,
    padding: Spacing.three,
  },
  savingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  savingsGlyph: {
    fontSize: 18,
  },
  savingsText: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  savingsAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
  },
  onGreenMuted: {
    color: 'rgba(255, 255, 255, 0.82)',
  },
  seeHow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  seeHowChevron: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 18,
    lineHeight: 18,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.light.text,
    borderRadius: 20,
    padding: Spacing.four,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.green,
  },
  ctaPlus: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 30,
  },
  ctaText: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  onInk: {
    color: '#FFFFFF',
  },
  onInkMuted: {
    color: 'rgba(255, 255, 255, 0.66)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  link: {
    color: BrandColors.green,
  },
  listStack: {
    gap: Spacing.two,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },
  listIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listGlyph: {
    fontSize: 20,
  },
  listText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 1,
  },
  listChips: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  priceColumn: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
});
