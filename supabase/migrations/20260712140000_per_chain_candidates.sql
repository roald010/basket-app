-- Rewrite get_list_item_candidates to retrieve the top-K products PER CHAIN instead of a
-- single global top-N. A global "order by similarity limit N" lets one chain with short
-- product names (e.g. Lidl's "Feta kaas") dominate the whole result and starve the others,
-- so the standardized kinds came out as "available at 1 store" -- the opposite of the
-- store-agnostic "available at many supermarkets" goal. Per-chain retrieval gives every
-- active chain a fair share, so a size-band kind spans the chains that actually carry it.
--
-- Postgres refuses CREATE OR REPLACE when a parameter is renamed but the argument types
-- stay the same (here: p_per_item -> p_per_chain), so the old signature must be dropped first.
drop function if exists get_list_item_candidates(uuid, int);

create function get_list_item_candidates(p_list_id uuid, p_per_chain int default 6)
returns table (
  list_item_id uuid,
  product_id bigint,
  chain_slug text,
  name text,
  parsed_quantity numeric,
  parsed_unit text,
  unit_type unit_type,
  price numeric,
  tier product_tier,
  score real
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  set local pg_trgm.similarity_threshold = 0.2;
  return query
  with items as (
    select
      li.id as list_item_id,
      lower(unaccent(coalesce(a.canonical_name, li.name))) as query_name
    from list_items li
    left join lateral (
      select canonical_name
      from ingredient_aliases
      where li.name ilike '%' || alias || '%'
      order by length(alias) desc
      limit 1
    ) a on true
    where li.list_id = p_list_id
  )
  select
    i.list_item_id,
    c.id,
    c.chain_slug,
    c.name,
    c.parsed_quantity,
    c.parsed_unit,
    c.unit_type,
    c.price,
    c.tier,
    c.score
  from items i
  cross join stores s
  cross join lateral (
    select
      p.id, p.chain_slug, p.name, p.parsed_quantity, p.parsed_unit, p.unit_type, p.price, p.tier,
      similarity(p.name_normalized, i.query_name) as score
    from products p
    where p.chain_slug = s.slug
      and p.is_active
      and p.name_normalized % i.query_name
    order by score desc
    limit greatest(coalesce(p_per_chain, 6), 1)
  ) c
  where s.active;
end;
$$;

grant execute on function get_list_item_candidates(uuid, int) to authenticated;
