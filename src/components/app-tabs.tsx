import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, BrandColors, Colors } from '@/constants/theme';
import { useTranslation } from '@/i18n';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { t } = useTranslation();

  return (
    // pointerEvents="box-none": only the FAB itself should be tappable, everything
    // else in this wrapper must pass touches through to the native tab bar beneath it.
    <View style={styles.wrapper} pointerEvents="box-none">
      <NativeTabs
        backgroundColor={colors.background}
        indicatorColor={colors.backgroundElement}
        labelStyle={{ selected: { color: colors.text } }}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>{t.nav.home}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="lists">
          <NativeTabs.Trigger.Label>{t.nav.lists}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="list.bullet" md="format_list_bulleted" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="staples">
          <NativeTabs.Trigger.Label>{t.nav.staples}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="repeat" md="repeat" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>{t.nav.profile}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        </NativeTabs.Trigger>
      </NativeTabs>

      {/*
        Center FAB, positioned to sit dead-center between the "Lijsten" and "Altijd
        erbij" tabs. NOT NativeTabs.BottomAccessory -- that API is @platform iOS 26+
        only (confirmed in expo-router's own type defs), so it can't cover
        Android/web/pre-26 iOS. This overlay works identically everywhere instead;
        BottomAccessory is a possible later iOS-26-specific polish pass, not a
        dependency for this to work at all.
      */}
      <Pressable
        onPress={() => router.push('/capture')}
        style={[styles.fab, { bottom: BottomTabInset - 16 }]}>
        <View style={[styles.fabPill, { backgroundColor: BrandColors.green }]}>
          <ThemedText type="smallBold" style={styles.fabIcon}>
            +
          </ThemedText>
        </View>
        <ThemedText type="small" style={{ color: BrandColors.green, fontWeight: '700' }}>
          {t.nav.basket}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -26 }],
    alignItems: 'center',
    gap: 4,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  fabPill: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.green,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 26,
  },
});
