import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Stepper } from '@/components/ui/stepper';
import { setDraft } from '@/features/capture/draft-store';
import { useParseRecipeMutation } from '@/features/recipes/api';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

export default function CaptureScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { listId, listName } = useLocalSearchParams<{ listId?: string; listName?: string }>();

  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [servings, setServings] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const parseRecipe = useParseRecipeMutation();

  const contentPlatformStyle = Platform.select({
    android: { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  const onRecognize = () => {
    setError(null);
    if (!text.trim()) {
      setError(t.capture.pasteSomethingFirst);
      return;
    }
    parseRecipe.mutate(
      { text, servingsTarget: servings },
      {
        onSuccess: (result) => {
          setDraft({
            listId: listId ?? null,
            listName: listName ?? null,
            title: result.title,
            originalText: text,
            servingsSource: result.servingsDetected,
            servingsTarget: result.servingsTarget,
            ingredients: result.ingredients.map((ingredient) => ({
              ...ingredient,
              isManuallyEdited: false,
            })),
          });
          router.push('/capture/review');
        },
        onError: () => setError(t.capture.parseError),
      }
    );
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary">
          {t.capture.addToList(listName ?? t.capture.newListDefaultName)}
        </ThemedText>
        <ThemedText type="subtitle">{t.capture.heading}</ThemedText>
      </View>

      <View style={styles.body}>
        <SegmentedControl
          options={[
            { value: 'text', label: t.capture.tabText },
            { value: 'link', label: t.capture.tabLink, disabled: true },
            { value: 'photo', label: t.capture.tabPhoto, disabled: true },
          ]}
          value={mode}
          onChange={setMode}
        />

        <ThemedText type="small" themeColor="textSecondary">
          {t.capture.linkHint}
        </ThemedText>

        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder={t.capture.textareaPlaceholder}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.textArea,
            { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundElement },
          ]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t.capture.growHint}
        </ThemedText>

        {/* Manual text entry has no known source serving count until parsing --
            the "recipe is for N" prefill note only makes sense for Link/Photo
            capture, where the source's own metadata could be read ahead of time. */}
        <View style={[styles.servingsCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold" style={styles.servingsText}>
            {t.capture.servingsQuestion}
          </ThemedText>
          <Stepper value={servings} onChange={setServings} min={1} max={12} />
        </View>

        {error && (
          <ThemedText type="small" style={{ color: theme.honestGapBorder }}>
            {error}
          </ThemedText>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          label={parseRecipe.isPending ? t.capture.recognizing : t.capture.recognize}
          variant="primary-ink"
          onPress={onRecognize}
          disabled={parseRecipe.isPending}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  body: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  textArea: {
    minHeight: 220,
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  servingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },
  servingsText: {
    flex: 1,
    gap: Spacing.half,
  },
  footer: {
    padding: Spacing.four,
    ...Platform.select({ web: { maxWidth: 480 } }),
  },
});
