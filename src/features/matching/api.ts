import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { embeddedOne } from '@/lib/postgrest';
import type { OptimizerItem } from '@/features/matching/optimize';
import type { ProductCandidate, ProductKind } from '@/features/matching/variants';

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
  /** The chosen product-"kind" label, e.g. "Blok kaas · ~500 g"; null = not yet chosen. */
  variantLabel: string | null;
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
      'id, recipe_id, source_type, name, quantity, unit, tier_override, variant_label, list_item_matches(chain_slug, match_status, products(name, price, tier))'
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
    variantLabel: item.variant_label,
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

type RawCandidate = {
  list_item_id: string;
  product_id: number;
  chain_slug: string;
  name: string;
  parsed_quantity: number | null;
  parsed_unit: string | null;
  unit_type: 'mass' | 'volume' | 'count' | null;
  price: number;
  tier: ProductTier | null;
  score: number;
};

async function fetchListItemCandidates(listId: string): Promise<Map<string, ProductCandidate[]>> {
  const { data, error } = await supabase.rpc('get_list_item_candidates', { p_list_id: listId });
  if (error) throw error;

  const byItem = new Map<string, ProductCandidate[]>();
  for (const row of (data ?? []) as RawCandidate[]) {
    const list = byItem.get(row.list_item_id) ?? [];
    list.push({
      productId: row.product_id,
      chainSlug: row.chain_slug,
      name: row.name,
      parsedQuantity: row.parsed_quantity,
      parsedUnit: row.parsed_unit,
      unitType: row.unit_type,
      price: row.price,
      tier: row.tier,
      score: row.score,
    });
    byItem.set(row.list_item_id, list);
  }
  return byItem;
}

/** Top matching products per item (keyed by list_item_id), which the screen clusters into a
 * few standardized "kinds" via standardizeVariants(). Store-agnostic -- chains aren't shown. */
export function useListItemCandidatesQuery(listId: string) {
  return useQuery({ queryKey: ['list-item-candidates', listId], queryFn: () => fetchListItemCandidates(listId) });
}

async function setItemVariant(input: { itemId: string; kind: ProductKind | null }): Promise<void> {
  const payload = input.kind
    ? {
        variant_label: input.kind.label,
        variant_query: input.kind.query || null,
        variant_unit_type: input.kind.unitType,
        variant_size_min: input.kind.sizeMin,
        variant_size_max: input.kind.sizeMax,
      }
    : { variant_label: null, variant_query: null, variant_unit_type: null, variant_size_min: null, variant_size_max: null };
  const { error } = await supabase.from('list_items').update(payload).eq('id', input.itemId);
  if (error) throw error;
}

/** Pins (or clears, via null) a single item's chosen product kind; callers should re-run
 * match_list_items() afterward so the pinned kind actually re-prices across chains. */
export function useSetItemVariantMutation(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setItemVariant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list-item-matches', listId] }),
  });
}
