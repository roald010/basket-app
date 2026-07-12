import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ServingsPicker } from '@/components/ui/servings-picker';
import { setDraft } from '@/features/capture/draft-store';
import { useParseRecipeMutation } from '@/features/recipes/api';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';

// Typical recipe convention and a common household size -- both fully editable below and
// again on Review before anything is actually committed.
const DEFAULT_RECIPE_SERVINGS = 4;
const DEFAULT_COOK_SERVINGS = 2;

export default function CaptureScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { listId, listName } = useLocalSearchParams<{ listId?: string; listName?: string }>();

  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [recipeServings, setRecipeServings] = useState(DEFAULT_RECIPE_SERVINGS);
  const [cookServings, setCookServings] = useState(DEFAULT_COOK_SERVINGS);
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
    // Sent as-is: the model's own detected serving count and this target are only used to
    // recover each ingredient's as-written amount on Review (see its `base` comment) --
    // that recovery is exact regardless of which target is sent. recipeServings is applied
    // separately, as recipeServingsPreset, once Review actually computes display quantities.
    parseRecipe.mutate(
      { text, servingsTarget: cookServings },
      {
        onSuccess: (result) => {
          setDraft({
            listId: listId ?? null,
            listName: listName ?? null,
            title: result.title,
            originalText: text,
            servingsSource: result.servingsDetected,
            servingsTarget: result.servingsTarget,
            recipeServingsPreset: recipeServings,
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

        <ServingsPicker
          recipeServings={recipeServings}
          onRecipeServingsChange={setRecipeServings}
          cookServings={cookServings}
          onCookServingsChange={setCookServings}
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
