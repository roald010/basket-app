import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { setDraft } from '@/features/capture/draft-store';
import { useParseRecipeMutation } from '@/features/recipes/api';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

// parse-recipe scales quantities by servingsTarget/servingsDetected, but review.tsx
// immediately divides that same factor back out to recover the as-written amount (see
// its `base` comment) -- the two cancel exactly regardless of which target was sent, so
// this value never affects what the user sees. The real "how many people" input lives on
// the Review screen (recipe's own count + cook-for count, both correctable there), not here.
const PARSE_SERVINGS_TARGET = 1;

export default function CaptureScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { listId, listName } = useLocalSearchParams<{ listId?: string; listName?: string }>();

  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const parseRecipe = useParseRecipeMutation();

  // No top inset here on purpose (matches review.tsx, the next step in this same
  // formSheet flow): this content lives inside a sheet, not a full-screen view, so
  // the device's status-bar/notch safe-area top inset doesn't apply -- adding it on
  // top of the header's own fixed padding produced a large, wrong gap above the sheet
  // content that isn't there in review.tsx.
  const contentPlatformStyle = Platform.select({
    android: { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four },
    ios: { paddingBottom: insets.bottom + Spacing.four },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  const onRecognize = () => {
    setError(null);
    if (!text.trim()) {
      setError(t.capture.pasteSomethingFirst);
      return;
    }
    parseRecipe.mutate(
      { text, servingsTarget: PARSE_SERVINGS_TARGET },
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
              quantity: ingredient.quantity || 1,
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
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
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
    // Extra room below the sheet's grabber handle (sheetGrabberVisible in
    // src/app/_layout.tsx) -- Spacing.two read as cramped right under it.
    paddingTop: Spacing.four,
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
  footer: {
    padding: Spacing.four,
    ...Platform.select({ web: { maxWidth: 480 } }),
  },
});
