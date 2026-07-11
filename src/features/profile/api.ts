import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type ShopperTier = 'budget' | 'balans' | 'premium';

export type Profile = {
  id: string;
  displayName: string | null;
  shopperTier: ShopperTier;
};

async function fetchProfile(): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('id, display_name, shopper_tier').single();
  if (error) throw error;

  return { id: data.id, displayName: data.display_name, shopperTier: data.shopper_tier };
}

/** `ensureSession()` (src/lib/supabase.ts) guarantees a row exists before any screen mounts. */
export function useProfileQuery() {
  return useQuery({ queryKey: ['profile'], queryFn: fetchProfile });
}

async function updateShopperTier(tier: ShopperTier): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No active Supabase session');

  const { error } = await supabase.from('profiles').update({ shopper_tier: tier }).eq('id', session.user.id);
  if (error) throw error;
}

/** Optimistic so the tier pill slides the instant it's tapped -- the choice re-prices
 * future matches, but there's no reason to make the UI wait on the round trip. */
export function useUpdateShopperTierMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateShopperTier,
    onMutate: async (tier) => {
      await queryClient.cancelQueries({ queryKey: ['profile'] });
      const previous = queryClient.getQueryData<Profile>(['profile']);
      queryClient.setQueryData<Profile>(['profile'], (old) => (old ? { ...old, shopperTier: tier } : old));
      return { previous };
    },
    onError: (_error, _tier, context) => {
      if (context?.previous) queryClient.setQueryData(['profile'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}
