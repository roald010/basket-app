import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { embeddedOne } from '@/lib/postgrest';
import { supabase } from '@/lib/supabase';

export type UserStore = {
  chainSlug: string;
  displayName: string;
  monogram: string;
};

const QUERY_KEY = ['user-stores'];

async function fetchUserStores(): Promise<UserStore[]> {
  const { data, error } = await supabase
    .from('user_stores')
    .select('chain_slug, stores(display_name, monogram)')
    .order('position');
  if (error) throw error;

  return data.flatMap((row) => {
    const store = embeddedOne(row.stores);
    return store ? [{ chainSlug: row.chain_slug, displayName: store.display_name, monogram: store.monogram }] : [];
  });
}

/** The user's chosen supermarkets (Profile's "Mijn supermarkten"). Distinct from
 * useStoresQuery (src/features/stores/api.ts), which is the full read-only catalog. */
export function useUserStoresQuery() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchUserStores });
}

async function addUserStore(chainSlug: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No active Supabase session');

  const { data: existing, error: fetchError } = await supabase
    .from('user_stores')
    .select('position')
    .order('position', { ascending: false })
    .limit(1);
  if (fetchError) throw fetchError;

  const nextPosition = (existing[0]?.position ?? -1) + 1;
  const { error } = await supabase
    .from('user_stores')
    .insert({ user_id: session.user.id, chain_slug: chainSlug, position: nextPosition });
  if (error) throw error;
}

export function useAddUserStoreMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addUserStore,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

async function removeUserStore(chainSlug: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No active Supabase session');

  const { error } = await supabase
    .from('user_stores')
    .delete()
    .eq('user_id', session.user.id)
    .eq('chain_slug', chainSlug);
  if (error) throw error;
}

/** Optimistic so the chip disappears instantly -- same pattern as useToggleItemCheckedMutation (src/features/shopping/api.ts). */
export function useRemoveUserStoreMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeUserStore,
    onMutate: async (chainSlug) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<UserStore[]>(QUERY_KEY);
      queryClient.setQueryData<UserStore[]>(QUERY_KEY, (old) => old?.filter((store) => store.chainSlug !== chainSlug));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
