import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { embeddedOne } from '@/lib/postgrest';
import type { OptimizerItem } from '@/features/matching/optimize';

export type ProductTier = 'budget' | 'standard' | 'premium';

export type ItemChainMatch = {
  chainSlug: string;
  matchStatus: 'matched' | 'no_match';
  price: number | null;
  /** The actually-matched product's own name/tier -- surfaces which real product the
   * shopper-tier setting picked, e.g. "AH Biologische pecorino" · premium. */
  productName: string | null;
  productTier: ProductTier | null;
};

export type ListItemMatchRow = {
  listItemId: string;
  /** null for staple/manual rows -- only recipe-sourced items belong to a recipe. */
  recipeId: string | null;
  sourceType: 'recipe' | 'staple' | 'manual';
  name: string;
  quantity: number | null;
  unit: string | null;
  /** null means "use the profile's shopper tier" -- set to override just this item. */
  tierOverride: ProductTier | null;
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
    .select(
      'id, recipe_id, source_type, name, quantity, unit, tier_override, list_item_matches(chain_slug, match_status, products(name, price, tier))'
    )
    .eq('list_id', listId);
  if (error) throw error;

  return data.map((item) => ({
    listItemId: item.id,
    recipeId: item.recipe_id,
    sourceType: item.source_type,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    tierOverride: item.tier_override,
    chains: item.list_item_matches.map((match) => {
      const product = embeddedOne(match.products);
      return {
        chainSlug: match.chain_slug,
        matchStatus: match.match_status,
        price: product?.price ?? null,
        productName: product?.name ?? null,
        productTier: product?.tier ?? null,
      };
    }),
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

async function setItemTierOverride(input: { itemId: string; tier: ProductTier | null }): Promise<void> {
  const { error } = await supabase.from('list_items').update({ tier_override: input.tier }).eq('id', input.itemId);
  if (error) throw error;
}

/** Sets (or clears, via null) a single item's tier override; callers should re-run
 * match_list_items() afterward so the new tier actually picks a different product. */
export function useSetItemTierOverrideMutation(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setItemTierOverride,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list-item-matches', listId] }),
  });
}
