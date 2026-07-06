import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { BrandColors } from '@/constants/theme';

const formatter = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

/** Formats a euro amount the way every price in the design does: "€19,40". */
export function formatEUR(amount: number) {
  return formatter.format(amount);
}

export type PriceTextProps = Omit<ThemedTextProps, 'tabularNums' | 'children'> & {
  amount: number;
  /** Render a signed delta, e.g. "-€2,40" for a saving. */
  signed?: boolean;
  color?: string;
};

/**
 * Money is always green tabular-nums in this design system -- this wrapper makes that
 * the default so it's enforced by construction rather than repeated at every call site.
 */
export function PriceText({ amount, signed, color = BrandColors.green, style, type = 'smallBold', ...rest }: PriceTextProps) {
  const value = signed && amount > 0 ? `+${formatEUR(amount)}` : formatEUR(amount);

  return (
    <ThemedText type={type} tabularNums style={[{ color }, style]} {...rest}>
      {value}
    </ThemedText>
  );
}
