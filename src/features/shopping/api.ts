import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { assignItems, type OptimizerItem, type StoreCombo } from '@/features/matching/optimize';
import { embeddedOne } from '@/lib/postgrest';
import { supabase } from '@/lib/supabase';

export type CommitSelectionInput = {
  listId: string;
  combo: StoreCombo;
  items: OptimizerItem[];
  /** Cheapest single-store total (when one store covers everything), for the saved saving baseline. */
  baselineSingleStoreTotal: number | null;
};

/**
 * Persists a store-count choice: assigns each item to its cheapest chain within the
 * combo (list_items.assigned_chain_slug), clears assignment for uncovered items, and
 * upserts the decision into store_selections. Assignment is grouped by chain so it is a
 * handful of round trips regardless of item count. Pure math (assignItems) is unit-tested;
 * these are plain owner-scoped writes (RLS enforces ownership).
 */
async function commitSelection(input: CommitSelectionInput): Promise<void> {
  const assignments = assignItems(input.items, input.combo.chains);
  const assignedIds = new Set(assignments.map((a) => a.listItemId));

  const idsByChain = new Map<string, string[]>();
  for (const a of assignments) {
    const ids = idsByChain.get(a.chainSlug) ?? [];
    ids.push(a.listItemId);
    idsByChain.set(a.chainSlug, ids);
  }

  for (const [chainSlug, ids] of idsByChain) {
    const { error } = await supabase.from('list_items').update({ assigned_chain_slug: chainSlug }).in('id', ids);
    if (error) throw error;
  }

  const unassignedIds = input.items.map((item) => item.listItemId).filter((id) => !assignedIds.has(id));
  if (unassignedIds.length > 0) {
    const { error } = await supabase.from('list_items').update({ assigned_chain_slug: null }).in('id', unassignedIds);
    if (error) throw error;
  }

  const total = assignments.reduce((sum, a) => sum + a.price, 0);
  const { error } = await supabase.from('store_selections').upsert(
    {
      list_id: input.listId,
      store_count: input.combo.storeCount,
      chosen_chains: input.combo.chains,
      total_price: total,
      baseline_single_store_total: input.baselineSingleStoreTotal,
      decided_at: new Date().toISOString(),
    },
    { onConflict: 'list_id' }
  );
  if (error) throw error;
}

export function useCommitSelectionMutation() {
  return useMutation({ mutationFn: commitSelection });
}

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  isChecked: boolean;
  /** null == the honest "zelf pakken" gap: no chosen store carries it. */
  assignedChainSlug: string | null;
  price: number | null;
};

async function fetchShoppingItems(listId: string): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('list_items')
    .select('id, name, quantity, unit, is_checked, assigned_chain_slug, list_item_matches(chain_slug, products(price))')
    .eq('list_id', listId)
    .order('position');
  if (error) throw error;

  return data.map((row) => {
    const match = row.assigned_chain_slug
      ? row.list_item_matches.find((m) => m.chain_slug === row.assigned_chain_slug)
      : undefined;
    return {
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      isChecked: row.is_checked,
      assignedChainSlug: row.assigned_chain_slug,
      price: match ? embeddedOne(match.products)?.price ?? null : null,
    };
  });
}

/** Flat item list for the Shopping screen; the screen groups by assignedChainSlug for display. */
export function useShoppingItemsQuery(listId: string) {
  return useQuery({ queryKey: ['shopping', listId], queryFn: () => fetchShoppingItems(listId) });
}

async function toggleItemChecked(input: { itemId: string; isChecked: boolean }): Promise<void> {
  const { error } = await supabase
    .from('list_items')
    .update({ is_checked: input.isChecked, checked_at: input.isChecked ? new Date().toISOString() : null })
    .eq('id', input.itemId);
  if (error) throw error;
}

/** Optimistic check-off so the tap feels instant; rolls back and refetches on error. */
export function useToggleItemCheckedMutation(listId: string) {
  const queryClient = useQueryClient();
  const key = ['shopping', listId];
  return useMutation({
    mutationFn: toggleItemChecked,
    onMutate: async ({ itemId, isChecked }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingItem[]>(key);
      queryClient.setQueryData<ShoppingItem[]>(key, (old) =>
        old?.map((item) => (item.id === itemId ? { ...item, isChecked } : item))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
