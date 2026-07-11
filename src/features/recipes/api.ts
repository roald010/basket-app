import { useMutation } from '@tanstack/react-query';

import type { DraftIngredient } from '@/features/capture/draft-store';
import { seedStaples } from '@/features/lists/api';
import type { Locale } from '@/i18n';
import { formatNewListName } from '@/lib/format-date';
import { supabase } from '@/lib/supabase';

export type ParsedIngredient = { name: string; quantity: number; unit: string };

export type ParseRecipeResult = {
  title: string;
  servingsDetected: number;
  servingsTarget: number;
  ingredients: ParsedIngredient[];
};

async function parseRecipe(input: { text: string; servingsTarget: number }): Promise<ParseRecipeResult> {
  const { data, error } = await supabase.functions.invoke<ParseRecipeResult>('parse-recipe', {
    body: input,
  });
  if (error) throw error;
  if (!data) throw new Error('parse-recipe returned no data');
  return data;
}

export function useParseRecipeMutation() {
  return useMutation({ mutationFn: parseRecipe });
}

export type CommitRecipeInput = {
  /** Existing list to add to, or null to start a brand-new list (gets a date-based default name -- rename lands with the List Hub in M4). */
  listId: string | null;
  locale: Locale;
  title: string;
  originalText: string;
  servingsSource: number;
  servingsTarget: number;
  ingredients: DraftIngredient[];
};

async function resolveListId(listId: string | null, userId: string, locale: Locale): Promise<string> {
  if (listId) return listId;
  const { data: list, error } = await supabase
    .from('lists')
    .insert({ user_id: userId, name: formatNewListName(locale) })
    .select('id')
    .single();
  if (error) throw error;
  await seedStaples(list.id, userId);
  return list.id;
}

async function commitRecipe(input: CommitRecipeInput): Promise<{ listId: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No active Supabase session');

  const listId = await resolveListId(input.listId, session.user.id, input.locale);

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      list_id: listId,
      name: input.title,
      original_text: input.originalText,
      servings_source: input.servingsSource,
      servings_target: input.servingsTarget,
    })
    .select('id')
    .single();
  if (recipeError) throw recipeError;

  const { error: itemsError } = await supabase.from('list_items').insert(
    input.ingredients.map((ingredient, index) => ({
      list_id: listId,
      source_type: 'recipe' as const,
      recipe_id: recipe.id,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      is_manually_edited: ingredient.isManuallyEdited,
      position: index,
    }))
  );
  if (itemsError) throw itemsError;

  // Matching runs on the List Hub itself (see list/[id].tsx), not here -- it needs to
  // re-run whenever the item set changes, not just once at commit time.

  return { listId };
}

export function useCommitRecipeMutation() {
  return useMutation({ mutationFn: commitRecipe });
}
