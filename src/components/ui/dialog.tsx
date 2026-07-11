import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DialogAction = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
};

export type DialogProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  /** Defaults to a single dismiss action if omitted. */
  actions: DialogAction[];
};

/**
 * The app's own centered alert/confirm, styled like every other card in the design
 * system (ThemedView + Button) instead of the OS default Alert.alert chrome -- used
 * everywhere a confirm or a quick info popup is needed (see staples.tsx, store-chip.tsx).
 */
export function Dialog({ visible, onClose, title, message, actions }: DialogProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* A dedicated touch-catching layer BEHIND the card, not a Pressable wrapping
            it -- nesting the card inside the backdrop's own Pressable (with the card's
            Pressable calling stopPropagation) is a known React Native footgun where the
            outer Pressable can still eat the tap meant for a button inside the card. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.cardWrap} pointerEvents="box-none">
          <ThemedView style={[styles.card, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="subtitle" style={styles.title}>
              {title}
            </ThemedText>
            {message && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
                {message}
              </ThemedText>
            )}
            <View style={actions.length > 1 ? styles.actionsRow : styles.actionsColumn}>
              {actions.map((action) => (
                <View key={action.label} style={actions.length > 1 ? styles.actionFlex : undefined}>
                  <Button label={action.label} variant={action.variant ?? 'outline'} onPress={action.onPress} />
                </View>
              ))}
            </View>
          </ThemedView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 340,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  actionsColumn: {
    marginTop: Spacing.three,
  },
  actionFlex: {
    flex: 1,
  },
});
