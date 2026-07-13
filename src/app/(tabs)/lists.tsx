import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { EntityCard } from '@/components/ui/entity-card';
import { NavIcon } from '@/components/ui/nav-icon';
import { SkeletonCard } from '@/components/ui/skeleton';
import { SwipeToDelete } from '@/components/ui/swipe-to-delete';
import { TabScreenTransition } from '@/components/ui/tab-screen-transition';
import { useCreateListMutation, useDeleteListMutation, useListsQuery, type ListSummary } from '@/features/lists/api';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';
import { formatListDate } from '@/lib/format-date';

/** A list card that reveals a delete action when swiped left. Swiping past the
 * threshold and tapping the X removes the list -- the deliberate swipe is the
 * confirmation, matching the iOS Mail delete pattern. */
function SwipeableListCard({ list, subtitle }: { list: ListSummary; subtitle: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const deleteList = useDeleteListMutation();

  return (
    <SwipeToDelete onDelete={() => deleteList.mutate(list.id)} deleteLabel={t.lists.deleteLabel(list.name)}>
      <EntityCard
        icon={<NavIcon name="lists" color={theme.textSecondary} />}
        title={list.name}
        subtitle={subtitle}
        price={list.fromPrice ?? undefined}
        priceCaption={list.fromPrice != null ? t.lists.fromStores(list.storeCount) : undefined}
        onPress={() => router.push(`/list/${list.id}`)}
      />
    </SwipeToDelete>
  );
}

export default function ListsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const { t, locale } = useTranslation();
  const { data: lists, isLoading, isError } = useListsQuery();
  const createList = useCreateListMutation();

  function handleNewList() {
    createList.mutate(locale, {
      onSuccess: ({ id }) => router.push(`/list/${id}`),
    });
  }

  // See index.tsx for why iOS now needs explicit padding (headless tab bar, no
  // more NativeTabs auto content-inset-adjustment).
  const contentPlatformStyle = Platform.select({
    ios: { paddingTop: insets.top, paddingBottom: insets.bottom },
    android: { paddingTop: insets.top, paddingBottom: insets.bottom },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  return (
    <TabScreenTransition routeIndex={1}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
      >
        <View style={styles.container}>
          <ThemedText type="title">{t.lists.title}</ThemedText>

          {isError && <ThemedText themeColor="textSecondary">{t.review.commitError}</ThemedText>}

          {isLoading && (
            <View style={styles.stack}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          )}

          <View style={styles.stack}>
            {lists?.map((list) => (
              <SwipeableListCard
                key={list.id}
                list={list}
                subtitle={`${t.home.recipesCount(list.recipeCount)} · ${t.lists.createdOn(formatListDate(list.createdAt, locale))}`}
              />
            ))}

            <Pressable
              onPress={handleNewList}
              disabled={createList.isPending}
              style={[styles.newList, { borderColor: theme.backgroundSelected }]}
            >
              <ThemedText type="smallBold" themeColor="textSecondary">
                + {t.home.newList}
              </ThemedText>
            </Pressable>
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
