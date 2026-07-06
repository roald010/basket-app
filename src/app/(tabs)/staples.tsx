import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatEUR } from '@/components/ui/price-text';
import { Stepper } from '@/components/ui/stepper';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

type Staple = {
  id: string;
  name: string;
  size: string;
  price: number;
  qty: number;
  emoji: string;
  /** Per-item icon-tile tint (light/dark) -- the design used a distinct hue per item. */
  tint: { light: string; dark: string };
};

const INITIAL_STAPLES: Staple[] = [
  { id: 'melk', name: 'Halfvolle melk', size: '1 L', price: 0.89, qty: 2, emoji: '🥛', tint: { light: '#E3EEF6', dark: '#26333D' } },
  { id: 'koffie', name: 'Koffiebonen', size: '500 g', price: 4.29, qty: 1, emoji: '☕️', tint: { light: '#EFE3D6', dark: '#3A2E22' } },
  { id: 'brood', name: 'Volkoren brood', size: '800 g', price: 1.59, qty: 1, emoji: '🍞', tint: { light: '#F3E7CE', dark: '#3A3220' } },
  { id: 'boter', name: 'Roomboter', size: '250 g', price: 2.09, qty: 0, emoji: '🧈', tint: { light: '#FBF1D2', dark: '#3D3720' } },
];

export default function StaplesScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const { t } = useTranslation();
  const [staples, setStaples] = useState(INITIAL_STAPLES);

  const setQty = (id: string, qty: number) =>
    setStaples((prev) => prev.map((item) => (item.id === id ? { ...item, qty } : item)));

  const contentPlatformStyle = Platform.select({
    android: { paddingTop: insets.top, paddingBottom: insets.bottom },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">{t.staples.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t.staples.subtitle}
          </ThemedText>
        </View>

        <View style={styles.list}>
          {staples.map((item) => {
            const isOff = item.qty === 0;
            return (
              // A qty-0 staple stays in the list, just soft-disabled -- the design keeps it
              // present-but-muted so the user can dial it back up rather than re-adding it.
              <ThemedView
                key={item.id}
                type="backgroundElement"
                style={[styles.card, isOff && styles.cardOff]}>
                <View
                  style={[
                    styles.iconTile,
                    { backgroundColor: isDark ? item.tint.dark : item.tint.light },
                  ]}>
                  <ThemedText style={styles.emoji}>{item.emoji}</ThemedText>
                </View>
                <View style={styles.cardBody}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.size} · {t.staples.fromPrice(formatEUR(item.price))}
                  </ThemedText>
                </View>
                <Stepper value={item.qty} onChange={(qty) => setQty(item.id, qty)} min={0} max={99} />
              </ThemedView>
            );
          })}

          <Pressable
            onPress={() => {}}
            style={[styles.addRow, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              + {t.staples.addProduct}
            </ThemedText>
          </Pressable>
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
  emoji: { fontSize: 22, lineHeight: 28 },
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
});
