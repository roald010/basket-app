import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { embeddedOne } from '@/lib/postgrest';
import type { OptimizerItem } from '@/features/matching/optimize';
import { CANDIDATE_FLOOR, MATCH_MIN_PROBABILITY, matchProbability } from '@/features/matching/score';
import {
  baseQuantity,
  standardizeVariants,
  type ProductCandidate,
  type ProductKind,
  type UnitType,
} from '@/features/matching/variants';
import { fetchUserStoreSlugs } from '@/features/stores/user-stores-api';

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

/** Narrows match rows to the (chain, price) pairs the optimizer consumes -- matched rows
 * with a real price only. When `allowedChainSlugs` is given, chains outside it are dropped
 * too, so Compare only ever recommends stores from the user's own "Mijn supermarkten"
 * (Profile) -- never a chain they haven't chosen. */
export function toOptimizerItems(rows: ListItemMatchRow[], allowedChainSlugs?: Set<string>): OptimizerItem[] {
  return rows.map((row) => ({
    listItemId: row.listItemId,
    prices: row.chains
      .filter(
        (chain): chain is ItemChainMatch & { price: number } =>
          chain.matchStatus === 'matched' && chain.price != null && (!allowedChainSlugs || allowedChainSlugs.has(chain.chainSlug))
      )
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

/** Per-item, per-chain match results written by matchListItems() below -- the raw material Compare ranks 1/2/3-store combos from. */
export function useListItemMatchesQuery(listId: string) {
  return useQuery({ queryKey: ['list-item-matches', listId], queryFn: () => fetchListItemMatches(listId) });
}

/**
 * Client-side matching -- replaces the old match_list_items() SQL function (dropped in
 * migration 20260712160000) so the exact same probability model (features/matching/score)
 * drives the kind chooser, the pre-selection, AND the persisted per-chain prices.
 *
 * Per item: resolve the kind in effect -- the user's pinned variant, or the auto
 * pre-selected top kind (identical to what the chooser marks "voorgeselecteerd") -- then
 * per user-selected chain pick the highest-probability candidate within that kind's size
 * band. Chains with nothing plausible get NO row: the honest "zelf pakken" gap, never a
 * guess. Existing matches are replaced wholesale so stale rows can't linger.
 */
async function matchListItems(listId: string): Promise<void> {
  const [itemsRes, candidatesByItem, allowedChainSlugs] = await Promise.all([
    supabase
      .from('list_items')
      .select('id, variant_unit_type, variant_size_min, variant_size_max')
      .eq('list_id', listId),
    fetchListItemCandidates(listId),
    fetchUserStoreSlugs(),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  const items = itemsRes.data;
  if (items.length === 0) return;

  const rows: {
    list_item_id: string;
    chain_slug: string;
    matched_product_id: number;
    match_confidence: number;
    match_status: 'matched';
  }[] = [];

  for (const item of items) {
    const entry = candidatesByItem.get(item.id);
    if (!entry) continue;

    // The size-band constraint in effect. The label is descriptive; the band (+ unit type)
    // is what's enforced, so "in N winkels" in the chooser equals the chains that match.
    let constraint: { unitType: UnitType; sizeMin: number; sizeMax: number } | null = null;
    if (item.variant_unit_type != null && item.variant_size_min != null && item.variant_size_max != null) {
      constraint = { unitType: item.variant_unit_type, sizeMin: item.variant_size_min, sizeMax: item.variant_size_max };
    } else {
      const preselected = standardizeVariants(entry.candidates, allowedChainSlugs)[0];
      if (preselected) constraint = { unitType: preselected.unitType, sizeMin: preselected.sizeMin, sizeMax: preselected.sizeMax };
    }

    const chains =
      allowedChainSlugs.size > 0 ? allowedChainSlugs : new Set(entry.candidates.map((candidate) => candidate.chainSlug));
    for (const chain of chains) {
      let best: ProductCandidate | null = null;
      for (const candidate of entry.candidates) {
        if (candidate.chainSlug !== chain) continue;
        if (constraint) {
          if (candidate.unitType !== constraint.unitType) continue;
          const base = baseQuantity(candidate);
          if (base == null || base < constraint.sizeMin || base > constraint.sizeMax) continue;
        }
        if (best === null || candidate.score > best.score) best = candidate;
      }
      if (best && best.score >= MATCH_MIN_PROBABILITY) {
        rows.push({
          list_item_id: item.id,
          chain_slug: chain,
          matched_product_id: best.productId,
          match_confidence: Math.round(best.score * 1000) / 1000,
          match_status: 'matched',
        });
      }
    }
  }

  const itemIds = items.map((item) => item.id);
  const deleted = await supabase.from('list_item_matches').delete().in('list_item_id', itemIds);
  if (deleted.error) throw deleted.error;
  if (rows.length > 0) {
    const inserted = await supabase.from('list_item_matches').insert(rows);
    if (inserted.error) throw inserted.error;
  }
}

/** Recomputes and persists all of a list's matches; callers should invalidate ['list-item-matches', listId] on success. */
export function useMatchListItemsMutation() {
  return useMutation({ mutationFn: matchListItems });
}

async function setItemTierOverride(input: { itemId: string; tier: ProductTier | null }): Promise<void> {
  const { error } = await supabase.from('list_items').update({ tier_override: input.tier }).eq('id', input.itemId);
  if (error) throw error;
}

/** Sets (or clears, via null) a single item's tier override. Vestigial: the probability
 * model doesn't use tier -- kept only because the column still exists. */
export function useSetItemTierOverrideMutation(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setItemTierOverride,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list-item-matches', listId] }),
  });
}

type RawCandidate = {
  list_item_id: string;
  query_name: string;
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

export type ItemCandidates = {
  /** The alias-resolved query the item was searched with -- what candidates were scored against. */
  queryName: string;
  candidates: ProductCandidate[];
};

async function fetchListItemCandidates(listId: string): Promise<Map<string, ItemCandidates>> {
  const { data, error } = await supabase.rpc('get_list_item_candidates', { p_list_id: listId });
  if (error) throw error;

  const byItem = new Map<string, ItemCandidates>();
  for (const row of (data ?? []) as RawCandidate[]) {
    // The RPC's word_similarity score is recall-only; the app's real ranking signal is
    // the token-level match probability, computed here once for everything downstream.
    // Candidates below the floor are unrelated products the recall net dragged in --
    // dropped entirely so they can't seed a kind or become a match.
    const probability = matchProbability(row.query_name, row.name);
    if (probability < CANDIDATE_FLOOR) continue;
    const entry = byItem.get(row.list_item_id) ?? { queryName: row.query_name, candidates: [] };
    entry.candidates.push({
      productId: row.product_id,
      chainSlug: row.chain_slug,
      name: row.name,
      parsedQuantity: row.parsed_quantity,
      parsedUnit: row.parsed_unit,
      unitType: row.unit_type,
      price: row.price,
      tier: row.tier,
      score: probability,
    });
    byItem.set(row.list_item_id, entry);
  }
  return byItem;
}

/** Top candidate products per item (keyed by list_item_id), scored with match
 * probabilities -- the input for both the kind chooser and client-side matching. */
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
 * useMatchListItemsMutation afterward so the pinned kind actually re-prices across chains. */
export function useSetItemVariantMutation(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setItemVariant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list-item-matches', listId] }),
  });
}
