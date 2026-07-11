import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { BrandColors, Spacing } from '@/constants/theme';
import { STORE_LOGOS } from '@/features/stores/store-logos';
import { useTheme } from '@/hooks/use-theme';

/** How long the pointer must stay over a chip before the name tooltip appears --
 * long enough that scanning across a row of chips doesn't flash a tooltip per chip. */
const HOVER_DELAY_MS = 450;

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
 * Hovering any chip (pointer devices only -- trackpad/mouse, not touch) reveals the
 * full chain name after a short delay, since logos alone aren't always recognizable
 * (lesser-known regional chains especially) and several places show a cluster of chips
 * with no adjacent text label at all (e.g. List Hub's combo picker). No longer a tap
 * popup -- that interrupted the flow for something this minor. */
export function StoreChip({ slug, displayName, monogram, isCheapest, size = 30 }: StoreChipProps) {
  const theme = useTheme();
  const logo = STORE_LOGOS[slug];
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  }, []);

  function handleHoverIn() {
    hoverTimeoutRef.current = setTimeout(() => setIsTooltipVisible(true), HOVER_DELAY_MS);
  }

  function handleHoverOut() {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsTooltipVisible(false);
  }

  return (
    <View style={styles.wrapper}>
      <AnimatedPressable
        scaleTo={0.92}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
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
      {isTooltipVisible && (
        <View style={styles.tooltip} pointerEvents="none">
          <ThemedText type="small" style={styles.tooltipText} numberOfLines={1}>
            {displayName}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoChip: {
    backgroundColor: '#FFFFFF',
    padding: 2,
  },
  tooltip: {
    position: 'absolute',
    bottom: '108%',
    // Fixed dark bubble regardless of light/dark theme (like a native OS tooltip) --
    // simpler than flipping bg/text per theme for a chip this small and short-lived.
    backgroundColor: '#211C15',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    zIndex: 10,
  },
  tooltipText: {
    color: '#FBF6EE',
  },
});
