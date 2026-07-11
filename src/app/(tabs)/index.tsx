import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { NavIcon } from '@/components/ui/nav-icon';
import { PriceText, formatEUR } from '@/components/ui/price-text';
import { TabScreenTransition } from '@/components/ui/tab-screen-transition';
import { useCreateListMutation, useListsQuery } from '@/features/lists/api';
import { useProfileQuery } from '@/features/profile/api';
import { useMonthlySavingsQuery } from '@/features/savings/api';
import { BottomTabInset, BrandColors, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';
import { formatListDate } from '@/lib/format-date';

export default function HomeScreen() {
  const theme = useTheme();
  const { t, locale, setLocale } = useTranslation();
  const safeAreaInsets = useSafeAreaInsets();
  const { data: lists } = useListsQuery();
  const { data: profile } = useProfileQuery();
  const { data: monthlySavings } = useMonthlySavingsQuery();
  const createList = useCreateListMutation();
  const recentLists = lists?.slice(0, 2) ?? [];

  function handleNewList() {
    createList.mutate(locale, {
      onSuccess: ({ id }) => router.push(`/list/${id}`),
    });
  }

  const hour = new Date().getHours();
  const daypart = hour < 6 || hour >= 18 ? 'evening' : hour < 12 ? 'morning' : 'afternoon';
  const currentMonthLabel = new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-US', { month: 'long' }).format(new Date());
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  // `contentInset` used to be enough on iOS because NativeTabs auto-enabled
  // contentInsetAdjustmentBehavior on the first nested ScrollView -- now that the
  // tab bar is the headless expo-router/ui Tabs (see app-tabs.tsx), that automatic
  // behavior is gone, so iOS needs the same explicit padding Android already used.
  const contentPlatformStyle = Platform.select({
    ios: { paddingTop: insets.top, paddingBottom: insets.bottom },
    android: { paddingTop: insets.top, paddingBottom: insets.bottom },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  return (
    <TabScreenTransition routeIndex={0}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText type="small" themeColor="textSecondary">
                {t.home.greeting(daypart, profile?.displayName ?? null)}
              </ThemedText>
              <ThemedText type="subtitle">{t.home.title}</ThemedText>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.home.switchLanguage}
                hitSlop={Spacing.two}
                onPress={() => setLocale(locale === 'nl' ? 'en' : 'nl')}
                style={[styles.langChip, { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedText style={styles.langGlobe}>🌐</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {locale.toUpperCase()}
                </ThemedText>
              </Pressable>
              <View style={[styles.avatar, { backgroundColor: theme.chipNeutralBg }]}>
                {profile?.displayName ? (
                  <ThemedText type="smallBold" style={[styles.avatarLetter, { color: BrandColors.green }]}>
                    {profile.displayName.charAt(0).toUpperCase()}
                  </ThemedText>
                ) : (
                  <NavIcon name="profile" color={BrandColors.green} size={22} />
                )}
              </View>
            </View>
          </View>

          {monthlySavings != null && monthlySavings > 0 && (
            <View style={styles.savingsRibbon}>
              <View style={styles.savingsIcon}>
                <ThemedText style={styles.savingsGlyph}>📈</ThemedText>
              </View>
              <View style={styles.savingsText}>
                <ThemedText type="small" style={styles.onGreenMuted}>
                  {t.home.savingsLabel(currentMonthLabel)}
                </ThemedText>
                <ThemedText type="subtitle" tabularNums style={styles.savingsAmount}>
                  {formatEUR(monthlySavings)}
                </ThemedText>
              </View>
              <Pressable style={styles.seeHow} hitSlop={Spacing.two}>
                <ThemedText type="small" style={styles.onGreenMuted}>
                  {t.home.seeHow}
                </ThemedText>
                <ThemedText style={styles.seeHowChevron}>›</ThemedText>
              </Pressable>
            </View>
          )}

          <Pressable style={styles.ctaCard} onPress={handleNewList} disabled={createList.isPending}>
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
            {recentLists.map((list) => (
              <Pressable
                key={list.id}
                onPress={() => router.push(`/list/${list.id}`)}
                style={[
                  styles.listCard,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.backgroundElement,
                  },
                ]}
              >
                <View style={[styles.listIcon, { backgroundColor: theme.backgroundElement }]}>
                  <NavIcon name="lists" color={theme.textSecondary} />
                </View>
                <View style={styles.listText}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {list.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {t.home.recipesCount(list.recipeCount)} · {t.lists.createdOn(formatListDate(list.createdAt, locale))}
                  </ThemedText>
                </View>
                {list.bestSingleStoreTotal != null && (
                  <View style={styles.priceColumn}>
                    <PriceText amount={list.bestSingleStoreTotal} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>
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
