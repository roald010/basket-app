import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** Realized savings this calendar month -- baseline_single_store_total is only set
 * when commit_store_selection (src/features/shopping/api.ts) recorded a multi-store
 * choice that actually beat the single-store total, so this never counts a 1-store
 * trip as a "saving". Null when no store_selections exist yet this month, not 0 --
 * the Home ribbon should stay hidden rather than claim a false €0,00. */
async function fetchMonthlySavings(): Promise<number | null> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('store_selections')
    .select('total_price, baseline_single_store_total')
    .gte('decided_at', startOfMonth.toISOString())
    .not('baseline_single_store_total', 'is', null);
  if (error) throw error;
  if (data.length === 0) return null;

  return data.reduce((sum, row) => sum + (row.baseline_single_store_total! - row.total_price), 0);
}

export function useMonthlySavingsQuery() {
  return useQuery({ queryKey: ['monthly-savings'], queryFn: fetchMonthlySavings });
}
