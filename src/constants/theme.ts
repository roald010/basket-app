/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Fixed brand hues -- Basket's palette from the design system. Unlike Colors.light/dark
// these don't flip with color scheme: green always means "cheapest/selected", never a
// real supermarket brand color (see store-chip.tsx).
export const BrandColors = {
  green: '#1E7A4D',
  clementine: '#F3922E',
  amber: '#C9772A',
} as const;

export const Colors = {
  light: {
    text: '#211C15',
    background: '#FBF6EE',
    backgroundElement: '#F1EADC',
    backgroundSelected: '#E4DBCB',
    textSecondary: '#8A8072',
    chipNeutralBg: '#ECE5D8',
    chipNeutralText: '#6B6357',
    chipCheapestBg: BrandColors.green,
    chipCheapestText: '#FFFFFF',
    honestGapBg: '#FCF1E2',
    honestGapBorder: '#EBC79A',
    headerGreen: BrandColors.green,
  },
  dark: {
    text: '#F4EEE2',
    background: '#211C15',
    backgroundElement: '#2A241B',
    backgroundSelected: '#3A3222',
    textSecondary: '#9A9284',
    chipNeutralBg: '#3A3222',
    chipNeutralText: '#B8B1A3',
    // Brighter than BrandColors.green for legibility against a dark surface -- same
    // "cheapest/selected" meaning, tuned for contrast (matches the design doc's own
    // dark-mode component-sheet example, which uses this exact green on dark).
    chipCheapestBg: '#55B487',
    chipCheapestText: '#08130D',
    // No dark-mode example existed in the design doc for the honest-gap card --
    // a judgement call deriving a muted amber consistent with the rest of the dark palette.
    honestGapBg: '#2E2415',
    honestGapBorder: '#6B4A24',
    headerGreen: BrandColors.green,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

const systemFonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
})!;

// Brand typefaces (Bricolage Grotesque for display/headings, Hanken Grotesk for UI &
// prices) loaded via useFonts() in the root layout. expo-font resolves these same
// family-name strings on web too (it injects @font-face rules keyed by the name passed
// to useFonts), so -- unlike systemFonts above -- no separate web/CSS-var branch is
// needed here; the loaded family name just works cross-platform once fonts are ready.
export const Fonts = {
  ...systemFonts,
  display: {
    semiBold: 'BricolageGrotesque_600SemiBold',
    bold: 'BricolageGrotesque_700Bold',
    extraBold: 'BricolageGrotesque_800ExtraBold',
  },
  body: {
    regular: 'HankenGrotesk_400Regular',
    medium: 'HankenGrotesk_500Medium',
    semiBold: 'HankenGrotesk_600SemiBold',
    bold: 'HankenGrotesk_700Bold',
    extraBold: 'HankenGrotesk_800ExtraBold',
  },
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
