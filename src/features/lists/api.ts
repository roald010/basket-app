import { useQuery } from '@tanstack/react-query';

import { bestCombos, type OptimizerItem } from '@/features/matching/optimize';
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
  recipes: ListRecipe[];
};

async function fetchList(id: string): Promise<ListDetail> {
  const { data, error } = await supabase
    .from('lists')
    .select('id, name, created_at, recipes(id, name, servings_target, list_items(id))')
    .eq('id', id)
    .single();
  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
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

export type ListSummary = {
  id: string;
  name: string;
  recipeCount: number;
  /** Cheapest single-store total, only when one store covers every item; null otherwise (never a partial total shown as if complete). */
  bestSingleStoreTotal: number | null;
};

async function fetchLists(): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('id, name, created_at, recipes(id), list_items(id, list_item_matches(chain_slug, match_status, products(price)))')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return data.map((list) => {
    const items: OptimizerItem[] = list.list_items.map((item) => ({
      listItemId: item.id,
      prices: item.list_item_matches.flatMap((match) => {
        const price = embeddedOne(match.products)?.price;
        return match.match_status === 'matched' && price != null ? [{ chainSlug: match.chain_slug, price }] : [];
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
      recipeCount: list.recipes.length,
      bestSingleStoreTotal,
    };
  });
}

export function useListsQuery() {
  return useQuery({ queryKey: ['lists'], queryFn: fetchLists });
}
