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
