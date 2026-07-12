export type DraftIngredient = {
  name: string;
  quantity: number | null;
  unit: string;
  isManuallyEdited: boolean;
};

export type RecipeDraft = {
  /** Existing list this recipe is being added to, or null when Capture started a brand-new list. */
  listId: string | null;
  /** Display name for the target list, or null for a not-yet-created list (see capture/index.tsx). */
  listName: string | null;
  title: string;
  originalText: string;
  servingsSource: number;
  servingsTarget: number;
  /** The "Recept voor" value the user set on Capture, before parsing -- Review's own
   * recipe-serving stepper starts here instead of the model's detected count (which may be
   * a guess when the pasted text never states it), without disturbing servingsSource/
   * servingsTarget above, which review.tsx still needs unchanged to correctly recover each
   * ingredient's as-written amount from the model's scaled response. */
  recipeServingsPreset: number;
  ingredients: DraftIngredient[];
};

/**
 * In-memory singleton carrying the parsed-recipe draft from Capture to Review --
 * avoids serializing a whole ingredient array into route params. Module state is
 * fine here: Capture -> Review is a same-JS-context navigation, never a cold start.
 */
let draft: RecipeDraft | null = null;

export function setDraft(next: RecipeDraft) {
  draft = next;
}

export function getDraft() {
  return draft;
}

export function clearDraft() {
  draft = null;
}
