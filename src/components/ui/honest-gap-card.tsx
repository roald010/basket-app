import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HonestGapCardProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * The "GEEN MATCH · zelf pakken" honesty pattern -- surfaced whenever an ingredient
 * has no product match at a given store. Amber, never hidden or silently dropped.
 */
export function HonestGapCard({ title, subtitle, actionLabel, onAction }: HonestGapCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.honestGapBg, borderColor: theme.honestGapBorder },
      ]}>
      <View style={styles.text}>
        <ThemedText type="small" style={{ color: theme.honestGapBorder }}>
          GEEN MATCH
        </ThemedText>
        <ThemedText type="smallBold">{title}</ThemedText>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={[styles.action, { backgroundColor: theme.honestGapBorder }]}>
          <ThemedText type="small" style={{ color: theme.background }}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : subtitle ? (
        <ThemedText type="small" style={{ color: theme.honestGapBorder }}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    borderWidth: 1.5,
    borderRadius: 15,
    padding: Spacing.two + Spacing.one,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  action: {
    borderRadius: 10,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two + Spacing.one,
  },
});
