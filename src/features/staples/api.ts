import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type StapleTemplate = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
};

const QUERY_KEY = ['staple-templates'];

async function fetchStapleTemplates(): Promise<StapleTemplate[]> {
  const { data, error } = await supabase
    .from('staple_templates')
    .select('id, name, default_quantity, unit')
    .order('position');
  if (error) throw error;

  return data.map((row) => ({ id: row.id, name: row.name, quantity: row.default_quantity, unit: row.unit }));
}

export function useStapleTemplatesQuery() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchStapleTemplates });
}

async function updateStapleQuantity(input: { id: string; quantity: number }): Promise<void> {
  const { error } = await supabase.from('staple_templates').update({ default_quantity: input.quantity }).eq('id', input.id);
  if (error) throw error;
}

/** Optimistic so the stepper feels instant -- same pattern as useToggleItemCheckedMutation (src/features/shopping/api.ts). */
export function useUpdateStapleQuantityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateStapleQuantity,
    onMutate: async ({ id, quantity }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<StapleTemplate[]>(QUERY_KEY);
      queryClient.setQueryData<StapleTemplate[]>(QUERY_KEY, (old) =>
        old?.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

async function updateStapleUnit(input: { id: string; unit: string | null }): Promise<void> {
  const { error } = await supabase.from('staple_templates').update({ unit: input.unit }).eq('id', input.id);
  if (error) throw error;
}

/** Lets "1" become "1 kg" -- the Stepper only ever adjusts the count, this is the only
 * way to say what that count is counting (e.g. buying quark by the kilo, not by the tub). */
export function useUpdateStapleUnitMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateStapleUnit,
    onMutate: async ({ id, unit }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<StapleTemplate[]>(QUERY_KEY);
      queryClient.setQueryData<StapleTemplate[]>(QUERY_KEY, (old) =>
        old?.map((item) => (item.id === id ? { ...item, unit } : item))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

async function addStapleTemplate(input: { name: string; unit: string | null }): Promise<StapleTemplate> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No active Supabase session');

  const { data: existing, error: fetchError } = await supabase
    .from('staple_templates')
    .select('position')
    .order('position', { ascending: false })
    .limit(1);
  if (fetchError) throw fetchError;

  const nextPosition = (existing[0]?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from('staple_templates')
    .insert({ user_id: session.user.id, name: input.name, unit: input.unit, default_quantity: 1, position: nextPosition })
    .select('id, name, default_quantity, unit')
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, quantity: data.default_quantity, unit: data.unit };
}

export function useAddStapleTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addStapleTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

async function deleteStapleTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('staple_templates').delete().eq('id', id);
  if (error) throw error;
}

/** list_items.staple_template_id is ON DELETE SET NULL (see core_schema.sql), so
 * lists that already snapshotted this staple keep their historical items untouched --
 * only future new lists stop picking it up. Optimistic, same pattern as the others here. */
export function useDeleteStapleTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStapleTemplate,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<StapleTemplate[]>(QUERY_KEY);
      queryClient.setQueryData<StapleTemplate[]>(QUERY_KEY, (old) => old?.filter((item) => item.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
