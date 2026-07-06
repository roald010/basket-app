import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { EntityCard } from '@/components/ui/entity-card';
import { useListsQuery } from '@/features/lists/api';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

export default function ListsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const { t } = useTranslation();
  const { data: lists, isLoading, isError } = useListsQuery();

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
        <ThemedText type="title">{t.lists.title}</ThemedText>

        {isLoading && <ThemedText themeColor="textSecondary">...</ThemedText>}
        {isError && <ThemedText themeColor="textSecondary">{t.review.commitError}</ThemedText>}

        <View style={styles.stack}>
          {lists?.map((list) => (
            <EntityCard
              key={list.id}
              icon={<ThemedText>🛒</ThemedText>}
              title={list.name}
              subtitle={t.home.recipesCount(list.recipeCount)}
              price={list.bestSingleStoreTotal ?? undefined}
              priceCaption={list.bestSingleStoreTotal != null ? t.lists.fromOneStore : undefined}
              onPress={() => router.push(`/list/${list.id}`)}
            />
          ))}

          <Pressable
            onPress={() => router.push('/capture')}
            style={[styles.newList, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              + {t.home.newList}
            </ThemedText>
          </Pressable>
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
    paddingVertical: Spacing.six,
  },
  stack: { gap: Spacing.three },
  newList: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: Spacing.three,
  },
});
