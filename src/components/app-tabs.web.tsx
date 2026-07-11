import { router } from 'expo-router';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { useCreateListMutation } from '@/features/lists/api';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslation } from '@/i18n';

export default function AppTabs() {
  const { t, locale } = useTranslation();
  const createList = useCreateListMutation();

  function handleNewList() {
    createList.mutate(locale, {
      onSuccess: ({ id }) => router.push(`/list/${id}`),
    });
  }

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>{t.nav.home}</TabButton>
          </TabTrigger>
          <TabTrigger name="lists" href="/lists" asChild>
            <TabButton>{t.nav.lists}</TabButton>
          </TabTrigger>
          {/* Center FAB -- BottomAccessory (native, iOS 26+ only) has no web
              equivalent anyway, so this is just a normal styled button here.
              Creates an empty list and lands on its Hub (see app-tabs.tsx). */}
          <Pressable onPress={handleNewList} disabled={createList.isPending} style={styles.fabPressable}>
            <View style={styles.fabPill}>
              <ThemedText type="smallBold" style={styles.fabIcon}>
                +
              </ThemedText>
              <ThemedText type="smallBold" style={styles.fabLabel}>
                {t.nav.newList}
              </ThemedText>
            </View>
          </Pressable>
          <TabTrigger name="staples" href="/staples" asChild>
            <TabButton>{t.nav.staples}</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>{t.nav.profile}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  fabPressable: {
    marginHorizontal: Spacing.one,
  },
  fabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: BrandColors.green,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  fabLabel: {
    color: '#FFFFFF',
  },
});
