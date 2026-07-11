import { useMutation, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { embeddedOne } from '@/lib/postgrest';
import type { OptimizerItem } from '@/features/matching/optimize';

export type ItemChainMatch = {
  chainSlug: string;
  matchStatus: 'matched' | 'no_match';
  price: number | null;
};

export type ListItemMatchRow = {
  listItemId: string;
  /** null for staple/manual rows -- only recipe-sourced items belong to a recipe. */
  recipeId: string | null;
  sourceType: 'recipe' | 'staple' | 'manual';
  name: string;
  quantity: number | null;
  unit: string | null;
  chains: ItemChainMatch[];
};

/** Narrows match rows to the (chain, price) pairs the optimizer consumes -- matched rows with a real price only. */
export function toOptimizerItems(rows: ListItemMatchRow[]): OptimizerItem[] {
  return rows.map((row) => ({
    listItemId: row.listItemId,
    prices: row.chains
      .filter((chain): chain is ItemChainMatch & { price: number } => chain.matchStatus === 'matched' && chain.price != null)
      .map((chain) => ({ chainSlug: chain.chainSlug, price: chain.price })),
  }));
}

async function fetchListItemMatches(listId: string): Promise<ListItemMatchRow[]> {
  const { data, error } = await supabase
    .from('list_items')
    .select('id, recipe_id, source_type, name, quantity, unit, list_item_matches(chain_slug, match_status, products(price))')
    .eq('list_id', listId);
  if (error) throw error;

  return data.map((item) => ({
    listItemId: item.id,
    recipeId: item.recipe_id,
    sourceType: item.source_type,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    chains: item.list_item_matches.map((match) => ({
      chainSlug: match.chain_slug,
      matchStatus: match.match_status,
      price: embeddedOne(match.products)?.price ?? null,
    })),
  }));
}

/** Per-item, per-chain match results written by match_list_items() -- the raw material Compare (later slice) ranks 1/2/3-store combos from. */
export function useListItemMatchesQuery(listId: string) {
  return useQuery({ queryKey: ['list-item-matches', listId], queryFn: () => fetchListItemMatches(listId) });
}

async function matchListItems(listId: string): Promise<void> {
  const { error } = await supabase.rpc('match_list_items', { p_list_id: listId });
  if (error) throw error;
}

/** Triggers the match_list_items() RPC for a list; callers should invalidate ['list-item-matches', listId] on success. */
export function useMatchListItemsMutation() {
  return useMutation({ mutationFn: matchListItems });
}
