import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Dialog } from '@/components/ui/dialog';
import { BrandColors } from '@/constants/theme';
import { STORE_LOGOS } from '@/features/stores/store-logos';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

export type StoreChipProps = {
  slug: string;
  displayName: string;
  monogram: string;
  /** Green marks the cheapest/selected store for this decision -- never implied by a
   * real brand color, so a logo chip shows this as a border ring, not a fill tint. */
  isCheapest?: boolean;
  size?: number;
};

/** Real chain logos (Wikimedia Commons) where available, falling back to the neutral
 * monogram chip for the couple of chains without a clean source (see store-logos.ts).
 * Tapping any chip reveals the full chain name via the app's own Dialog -- logos alone
 * aren't always recognizable (lesser-known regional chains especially), and several
 * places show a cluster of chips with no adjacent text label at all (e.g. List Hub's
 * combo picker). */
export function StoreChip({ slug, displayName, monogram, isCheapest, size = 30 }: StoreChipProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const logo = STORE_LOGOS[slug];
  const [isNameVisible, setIsNameVisible] = useState(false);

  return (
    <>
      <AnimatedPressable
        scaleTo={0.92}
        onPress={() => setIsNameVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={displayName}
        style={[
          styles.chip,
          logo
            ? [
                styles.logoChip,
                { width: size, height: size, borderRadius: size * 0.3 },
                isCheapest && { borderWidth: 2, borderColor: BrandColors.green },
              ]
            : {
                width: size,
                height: size,
                borderRadius: size * 0.3,
                backgroundColor: isCheapest ? theme.chipCheapestBg : theme.chipNeutralBg,
              },
        ]}>
        {logo ? (
          <SvgXml xml={logo} width={size * 0.72} height={size * 0.72} />
        ) : (
          <ThemedText
            type="smallBold"
            style={{ color: isCheapest ? theme.chipCheapestText : theme.chipNeutralText, fontSize: size * 0.4 }}>
            {monogram}
          </ThemedText>
        )}
      </AnimatedPressable>
      <Dialog
        visible={isNameVisible}
        onClose={() => setIsNameVisible(false)}
        title={displayName}
        actions={[{ label: t.common.ok, onPress: () => setIsNameVisible(false) }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoChip: {
    backgroundColor: '#FFFFFF',
    padding: 2,
  },
});
