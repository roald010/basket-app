import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Stepper } from '@/components/ui/stepper';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

export type ServingsPickerProps = {
  recipeServings: number;
  onRecipeServingsChange: (value: number) => void;
  cookServings: number;
  onCookServingsChange: (value: number) => void;
};

/** The "Recept voor" (recipe's own serving count) / "Ik kook voor" (who you're actually
 * cooking for) pair -- shared by Capture (sets the starting point before parsing) and
 * Review (still correctable after, e.g. when the pasted text never stated its own count). */
export function ServingsPicker({
  recipeServings,
  onRecipeServingsChange,
  cookServings,
  onCookServingsChange,
}: ServingsPickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.label}>
          {t.review.servingsRecipeLabel}
        </ThemedText>
        <Stepper value={recipeServings} onChange={onRecipeServingsChange} min={1} max={20} />
      </View>
      <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.label}>
          {t.review.servingsTargetLabel}
        </ThemedText>
        <Stepper value={cookServings} onChange={onCookServingsChange} min={1} max={20} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    height: 1,
  },
});
