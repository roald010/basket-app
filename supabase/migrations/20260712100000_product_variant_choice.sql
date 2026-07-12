-- Product-"kind" choice: let a user pick which standardized kind of product a loose list
-- item means (e.g. a big block of cheese vs. small blocks), store-agnostically, and price
-- that kind across every chain. Adds the reproducible description of the chosen kind to
-- list_items, two candidate-retrieval RPCs the client clusters into a few choices, and
-- teaches match_list_items() to honor a chosen kind when re-matching.

-- 1. The chosen kind, stored on the item so a re-match (and the daily ingest) reproduces
--    the same kind at each chain rather than re-guessing from the raw name.
alter table list_items
  add column variant_label text,       -- display label, e.g. "Blok kaas · ~500 g"
  add column variant_query text,       -- normalized name to match per chain
  add column variant_unit_type unit_type,
  add column variant_size_min numeric, -- inclusive size band (in the unit_type's base unit)
  add column variant_size_max numeric;

-- 2a. Flat similarity search over the whole catalog -- top-N active products across all
--     active chains for a free-text query. Used for ad-hoc "find another product" needs.
create or replace function search_product_candidates(p_query text, p_limit int default 40)
returns table (
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
declare
  q text := lower(unaccent(coalesce(p_query, '')));
begin
  set local pg_trgm.similarity_threshold = 0.2;
  if q = '' then
    return;
  end if;
  return query
    select
      p.id,
      p.chain_slug,
      p.name,
      p.parsed_quantity,
      p.parsed_unit,
      p.unit_type,
      p.price,
      p.tier,
      similarity(p.name_normalized, q) as score
    from products p
    join stores s on s.slug = p.chain_slug and s.active
    where p.is_active and p.name_normalized % q
    order by score desc
    limit greatest(coalesce(p_limit, 40), 1);
end;
$$;

-- 2b. Batched candidate retrieval for a whole list: the top-N candidates per item, using
--     the same alias/query-name resolution as match_list_items (but ignoring any already-
--     chosen variant, so the chooser can offer the full set of kinds). One round-trip; the
--     client clusters these into a few standardized "kinds" (see features/matching/variants).
create or replace function get_list_item_candidates(p_list_id uuid, p_per_item int default 40)
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
  cross join lateral (
    select
      p.id, p.chain_slug, p.name, p.parsed_quantity, p.parsed_unit, p.unit_type, p.price, p.tier,
      similarity(p.name_normalized, i.query_name) as score
    from products p
    join stores s on s.slug = p.chain_slug and s.active
    where p.is_active and p.name_normalized % i.query_name
    order by score desc
    limit greatest(coalesce(p_per_item, 40), 1)
  ) c;
end;
$$;

-- 3. Re-create match_list_items to honor a chosen kind. When variant_* is set on the item,
--    candidates at each chain are constrained to that unit_type and size band and ranked
--    against variant_query; otherwise behavior is unchanged (alias/name + tier bonus).
create or replace function match_list_items(p_list_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_shopper_tier shopper_tier;
  v_default_tier product_tier;
begin
  set local pg_trgm.similarity_threshold = 0.2;

  select shopper_tier into v_shopper_tier from profiles where id = auth.uid();
  v_default_tier := case v_shopper_tier
    when 'budget' then 'budget'::product_tier
    when 'premium' then 'premium'::product_tier
    else 'standard'::product_tier
  end;

  with items as (
    select
      li.id as list_item_id,
      coalesce(li.tier_override, v_default_tier) as preferred_tier,
      li.variant_unit_type,
      li.variant_size_min,
      li.variant_size_max,
      -- a chosen kind's standardized query wins over the alias/raw name.
      lower(unaccent(coalesce(li.variant_query, a.canonical_name, li.name))) as query_name
    from list_items li
    left join lateral (
      select canonical_name, alias
      from ingredient_aliases
      where li.name ilike '%' || alias || '%'
      order by length(alias) desc
      limit 1
    ) a on true
    where li.list_id = p_list_id
  ),
  candidates as (
    select
      i.list_item_id,
      s.slug as chain_slug,
      c.id as product_id,
      c.score
    from items i
    cross join stores s
    left join lateral (
      select
        p.id,
        similarity(p.name_normalized, i.query_name)
          + case when p.tier = i.preferred_tier then 0.05 else 0 end as score
      from products p
      where p.chain_slug = s.slug
        and p.is_active
        and p.name_normalized % i.query_name
        and (i.variant_unit_type is null or p.unit_type = i.variant_unit_type)
        and (i.variant_size_min is null or p.parsed_quantity >= i.variant_size_min)
        and (i.variant_size_max is null or p.parsed_quantity <= i.variant_size_max)
      order by score desc
      limit 1
    ) c on true
    where s.active
  )
  insert into list_item_matches (list_item_id, chain_slug, matched_product_id, match_confidence, match_status, computed_at)
  select
    list_item_id,
    chain_slug,
    case when score >= 0.3 then product_id else null end,
    score,
    case when score >= 0.3 then 'matched'::match_status else 'no_match'::match_status end,
    now()
  from candidates
  on conflict (list_item_id, chain_slug)
  do update set
    matched_product_id = excluded.matched_product_id,
    match_confidence = excluded.match_confidence,
    match_status = excluded.match_status,
    computed_at = now();
end;
$$;

grant execute on function search_product_candidates(text, int) to authenticated;
grant execute on function get_list_item_candidates(uuid, int) to authenticated;
grant execute on function match_list_items(uuid) to authenticated;
