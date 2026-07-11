import { router, usePathname } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Path, Svg } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { useCreateListMutation } from '@/features/lists/api';
import { BrandColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

// The bar has 5 equal (flex: 1) slots; the middle one is the raised "+ Nieuw" FAB, so
// the sliding indicator only ever rests under a real tab: Home 0, Lijsten 1, [FAB 2],
// Altijd erbij 3, Profiel 4.
const SLOT_COUNT = 5;
const BAR_H_PADDING = 12;
const INDICATOR_WIDTH = 26;

function slotForPath(pathname: string): number {
  if (pathname === '/lists') return 1;
  if (pathname === '/staples') return 3;
  if (pathname.startsWith('/profile')) return 4;
  return 0;
}

type NavButtonProps = TabTriggerSlotProps & { icon: NavIconName; label: string };

/**
 * A real 5th flex child (not an absolutely-positioned overlay) so the "+ Nieuw"
 * button gets its own reserved slot between Lijsten and Altijd erbij, matching
 * the design doc's own bottom-nav markup (5 flex children, the middle one
 * raised via negative margin-top) instead of floating over the other tabs.
 * expo-router/ui's Tabs already worked this way on web (app-tabs.web.tsx);
 * this ports the same approach to native to fix the overlap for good.
 */
function NavButton({ icon, label, isFocused, ...props }: NavButtonProps) {
  const theme = useTheme();
  const color = isFocused ? BrandColors.green : theme.textSecondary;

  return (
    <AnimatedPressable {...props} scaleTo={0.9} style={styles.navButton}>
      <NavIcon name={icon} color={color} active={isFocused} />
      <ThemedText type="small" style={[styles.navLabel, { color }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function AppTabs() {
  const theme = useTheme();
  const { t, locale } = useTranslation();
  const insets = useSafeAreaInsets();
  const createList = useCreateListMutation();
  const pathname = usePathname();
  const activeSlot = slotForPath(pathname);

  // Sliding indicator (adapted from the dev.to "Animated Sliding Tab Bar" tutorial):
  // measure the bar, split into equal slots, translate a small pill to the active one.
  // Done with Reanimated for consistency with the rest of the app, and kept entirely
  // inside this bar View -- it never touches TabSlot/react-native-screens, which is
  // what turned an earlier screen-level attempt into a vanished nav bar.
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (barWidth === 0) return;
    const tabWidth = (barWidth - BAR_H_PADDING * 2) / SLOT_COUNT;
    const target = BAR_H_PADDING + activeSlot * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2;
    if (initialized.current) {
      indicatorX.value = withSpring(target, { damping: 20, stiffness: 420, mass: 0.6 });
    } else {
      indicatorX.value = target;
      initialized.current = true;
    }
  }, [activeSlot, barWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicatorX.value }] }));

  function handleNewList() {
    createList.mutate(locale, {
      onSuccess: ({ id }) => router.push(`/list/${id}`),
    });
  }

  function handleBarLayout(event: LayoutChangeEvent) {
    setBarWidth(event.nativeEvent.layout.width);
  }

  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        {/* TabList's asChild renders a Slot -- its direct child needs one flat style
            object, not an array (Slot forwards/merges props and chokes on arrays). */}
        <View
          onLayout={handleBarLayout}
          style={StyleSheet.flatten([
            styles.bar,
            { backgroundColor: theme.background, borderTopColor: theme.backgroundElement, paddingBottom: insets.bottom + 10 },
          ])}>
          {barWidth > 0 && (
            <Animated.View style={[styles.indicator, { backgroundColor: BrandColors.green }, indicatorStyle]} />
          )}
          <TabTrigger name="index" href="/" asChild>
            <NavButton icon="home" label={t.nav.home} />
          </TabTrigger>
          <TabTrigger name="lists" href="/lists" asChild>
            <NavButton icon="lists" label={t.nav.lists} />
          </TabTrigger>
          <AnimatedPressable onPress={handleNewList} disabled={createList.isPending} scaleTo={0.88} style={styles.fabButton}>
            <View style={StyleSheet.flatten([styles.fabPill, { backgroundColor: BrandColors.green }])}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
              </Svg>
            </View>
            <ThemedText type="small" style={styles.fabLabel} numberOfLines={1}>
              {t.nav.newList}
            </ThemedText>
          </AnimatedPressable>
          <TabTrigger name="staples" href="/staples" asChild>
            <NavButton icon="staples" label={t.nav.staples} />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <NavButton icon="profile" label={t.nav.profile} />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: BAR_H_PADDING,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: INDICATOR_WIDTH,
    height: 3,
    borderRadius: 2,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  fabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    marginTop: -16,
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
  fabLabel: {
    color: BrandColors.green,
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 12,
  },
});
