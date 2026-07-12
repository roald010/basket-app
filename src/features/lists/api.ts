import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bestCombos, type OptimizerItem } from '@/features/matching/optimize';
import { fetchUserStoreSlugs } from '@/features/stores/user-stores-api';
import type { Locale } from '@/i18n';
import { formatNewListName } from '@/lib/format-date';
import { embeddedOne } from '@/lib/postgrest';
import { supabase } from '@/lib/supabase';

export type ListRecipe = {
  id: string;
  name: string;
  servingsTarget: number;
  itemCount: number;
};

export type ListDetail = {
  id: string;
  name: string;
  createdAt: string;
  includeStaples: boolean;
  recipes: ListRecipe[];
};

async function fetchList(id: string): Promise<ListDetail> {
  const { data, error } = await supabase
    .from('lists')
    .select('id, name, created_at, include_staples, recipes(id, name, servings_target, list_items(id))')
    .eq('id', id)
    .single();
  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    includeStaples: data.include_staples,
    recipes: data.recipes.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      servingsTarget: recipe.servings_target,
      itemCount: recipe.list_items.length,
    })),
  };
}

export function useListQuery(id: string) {
  return useQuery({ queryKey: ['list', id], queryFn: () => fetchList(id) });
}

/** Copies the user's active staple templates (default_quantity > 0) into a new
 * list's list_items as a one-time snapshot -- see staple_templates' migration
 * comment for why this doesn't link live. Shared by createList() below and
 * resolveListId()'s new-list branch in features/recipes/api.ts, since both are
 * "a brand new list just came into existence" points. */
export async function seedStaples(listId: string, userId: string): Promise<void> {
  const { data: templates, error: templatesError } = await supabase
    .from('staple_templates')
    .select('id, name, default_quantity, unit, position')
    .eq('user_id', userId)
    .gt('default_quantity', 0)
    .order('position');
  if (templatesError) throw templatesError;
  if (templates.length === 0) return;

  const { error: itemsError } = await supabase.from('list_items').insert(
    templates.map((template, index) => ({
      list_id: listId,
      source_type: 'staple' as const,
      staple_template_id: template.id,
      name: template.name,
      quantity: template.default_quantity,
      unit: template.unit,
      is_manually_edited: false,
      position: index,
    }))
  );
  if (itemsError) throw itemsError;
}

/** Resolves the name for a brand-new list: the date-based default (formatNewListName),
 * suffixed " (2)", " (3)", etc. when this user already has another list with that exact
 * base name today. Checks actual name collisions rather than counting today's created_at
 * rows, so a same-day list that's since been renamed away doesn't still "reserve" its
 * number, and nothing skips a number either. Shared by createList below and
 * resolveListId's new-list branch in features/recipes/api.ts. */
export async function resolveNewListName(userId: string, locale: Locale): Promise<string> {
  const base = formatNewListName(locale);
  const { data: existing, error } = await supabase.from('lists').select('name').eq('user_id', userId).ilike('name', `${base}%`);
  if (error) throw error;

  const names = new Set((existing ?? []).map((row) => row.name));
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} (${suffix})`)) suffix += 1;
  return `${base} (${suffix})`;
}

/** The "+ Nieuw" tab creates an empty list and lands on its Hub -- matching the
 * design's flow diagram ("Basket-knop -> lege lijst -> Hub") and the "a list is
 * not a recipe" model: capture is a repeatable action taken *from* the Hub
 * (its own "+ Recept toevoegen" row), not the tab bar's direct destination. */
async function createList(locale: Locale): Promise<{ id: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No active Supabase session');

  const name = await resolveNewListName(session.user.id, locale);
  const { data, error } = await supabase.from('lists').insert({ user_id: session.user.id, name }).select('id').single();
  if (error) throw error;
  await seedStaples(data.id, session.user.id);
  return { id: data.id };
}

export function useCreateListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createList,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lists'] }),
  });
}

async function renameList(input: { id: string; name: string }): Promise<void> {
  const { error } = await supabase.from('lists').update({ name: input.name }).eq('id', input.id);
  if (error) throw error;
}

async function deleteList(id: string): Promise<void> {
  // recipes, list_items, list_item_matches and store_selections all reference lists with
  // ON DELETE CASCADE (see core_schema.sql), so this single delete removes the whole list.
  const { error } = await supabase.from('lists').delete().eq('id', id);
  if (error) throw error;
}

/** Optimistic so the swiped card disappears immediately; the row is gone from the DB
 * on success, restored to the cache on failure. */
export function useDeleteListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteList,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['lists'] });
      const previous = queryClient.getQueryData<ListSummary[]>(['lists']);
      queryClient.setQueryData<ListSummary[]>(['lists'], (old) => old?.filter((list) => list.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['lists'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['lists'] }),
  });
}

export function useRenameListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: renameList,
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['list', id] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

async function setIncludeStaples(input: { id: string; includeStaples: boolean }): Promise<void> {
  const { error } = await supabase.from('lists').update({ include_staples: input.includeStaples }).eq('id', input.id);
  if (error) throw error;
}

/** Optimistic so the toggle feels instant -- same pattern as useUpdateStapleQuantityMutation. */
export function useSetIncludeStaplesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setIncludeStaples,
    onMutate: async ({ id, includeStaples }) => {
      await queryClient.cancelQueries({ queryKey: ['list', id] });
      const previous = queryClient.getQueryData<ListDetail>(['list', id]);
      queryClient.setQueryData<ListDetail>(['list', id], (old) => (old ? { ...old, includeStaples } : old));
      return { previous };
    },
    onError: (_error, { id }, context) => {
      if (context?.previous) queryClient.setQueryData(['list', id], context.previous);
    },
    onSettled: (_data, _error, { id }) => queryClient.invalidateQueries({ queryKey: ['list', id] }),
  });
}

async function addManualItem(input: { listId: string; name: string }): Promise<void> {
  const { error } = await supabase.from('list_items').insert({
    list_id: input.listId,
    source_type: 'manual' as const,
    name: input.name,
    quantity: 1,
    is_manually_edited: true,
  });
  if (error) throw error;
}

/** One-off products added straight to a list (List Hub's "Losse producten" section) --
 * not tied to a recipe or a staple_template. Callers should debounce the follow-up
 * match_list_items call themselves when adding several in a row (see list/[id].tsx) --
 * this mutation only writes the row, it doesn't re-match on every single add. */
export function useAddManualItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addManualItem,
    onSuccess: (_data, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
      queryClient.invalidateQueries({ queryKey: ['list-item-matches', listId] });
      // The new item needs its own product-kind candidates fetched, or the chooser
      // (and its "kies soort" flag) never appears for it -- see features/matching/api.
      queryClient.invalidateQueries({ queryKey: ['list-item-candidates', listId] });
    },
  });
}

async function removeListItem(input: { id: string; listId: string }): Promise<void> {
  const { error } = await supabase.from('list_items').delete().eq('id', input.id);
  if (error) throw error;
}

export function useRemoveListItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeListItem,
    onSuccess: (_data, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
      queryClient.invalidateQueries({ queryKey: ['list-item-matches', listId] });
      queryClient.invalidateQueries({ queryKey: ['list-item-candidates', listId] });
    },
  });
}

export type ListSummary = {
  id: string;
  name: string;
  createdAt: string;
  recipeCount: number;
  /** Cheapest single-store total, only when one store covers every item; null otherwise (never a partial total shown as if complete). */
  bestSingleStoreTotal: number | null;
};

async function fetchLists(): Promise<ListSummary[]> {
  const [{ data, error }, allowedChainSlugs] = await Promise.all([
    supabase
      .from('lists')
      .select(
        'id, name, created_at, recipes(id), list_items(id, source_type, list_item_matches(chain_slug, match_status, products(price)))'
      )
      .order('created_at', { ascending: false }),
    fetchUserStoreSlugs(),
  ]);
  if (error) throw error;

  // An empty list -- no recipes, no manually-added products -- exists the moment
  // "+ Nieuw" is tapped, before the user has done anything with it. That's expected at
  // List Hub (reachable directly), but it shouldn't clutter the Home/Lists feeds.
  // seedStaples auto-copies the user's staple templates into every brand-new list, so
  // item count alone would make almost every list "non-empty" immediately -- only
  // recipes and deliberately-added ('manual') items count as real content.
  return data
    .filter((list) => list.recipes.length > 0 || list.list_items.some((item) => item.source_type === 'manual'))
    .map((list) => {
      // Only the user's own chosen chains ("Mijn supermarkten") count toward this preview
      // total -- same rule as List Hub's Compare (features/matching/api.ts's toOptimizerItems).
      const items: OptimizerItem[] = list.list_items.map((item) => ({
        listItemId: item.id,
        prices: item.list_item_matches.flatMap((match) => {
          const price = embeddedOne(match.products)?.price;
          return match.match_status === 'matched' && price != null && allowedChainSlugs.has(match.chain_slug)
            ? [{ chainSlug: match.chain_slug, price }]
            : [];
        }),
      }));

      // Only a full-coverage single store gets a headline price -- a partial total would
      // read as complete and undersell the real basket (the honest-gap principle).
      const best = bestCombos(items, 1)[0];
      const bestSingleStoreTotal =
        best && items.length > 0 && best.coveredCount === items.length ? best.total : null;

      return {
        id: list.id,
        name: list.name,
        createdAt: list.created_at,
        recipeCount: list.recipes.length,
        bestSingleStoreTotal,
      };
    });
}

export function useListsQuery() {
  return useQuery({ queryKey: ['lists'], queryFn: fetchLists });
}
