import { Switch, type SwitchProps } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ToggleProps = Omit<SwitchProps, 'trackColor' | 'thumbColor'>;

export function Toggle(props: ToggleProps) {
  const theme = useTheme();

  return (
    <Switch
      trackColor={{ false: theme.backgroundSelected, true: BrandColors.green }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={theme.backgroundSelected}
      {...props}
    />
  );
}
