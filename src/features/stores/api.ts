import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type Store = {
  slug: string;
  displayName: string;
  monogram: string;
};

async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase.from('stores').select('slug, display_name, monogram').eq('active', true);
  if (error) throw error;

  return data.map((store) => ({
    slug: store.slug,
    displayName: store.display_name,
    monogram: store.monogram,
  }));
}

/** Reference data (12 chains) -- rarely changes, safe to cache for the whole session. */
export function useStoresQuery() {
  return useQuery({ queryKey: ['stores'], queryFn: fetchStores, staleTime: Infinity });
}
