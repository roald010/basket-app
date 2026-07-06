import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary-ink' | 'primary-green' | 'outline' | 'fix-it';

export type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
};

export function Button({ label, variant = 'primary-green', disabled, ...rest }: ButtonProps) {
  const theme = useTheme();

  const backgroundColor = {
    'primary-ink': theme.text,
    'primary-green': BrandColors.green,
    outline: 'transparent',
    'fix-it': BrandColors.amber,
  }[variant];

  const textColor = variant === 'outline' ? theme.text : theme.background;

  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor, opacity: disabled ? 0.5 : 1 },
        variant === 'outline' && { borderWidth: 1.5, borderColor: theme.backgroundSelected },
      ]}
      {...rest}>
      <ThemedText type="smallBold" style={{ color: textColor }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
