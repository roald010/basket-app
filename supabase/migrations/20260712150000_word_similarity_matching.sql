-- Switch matching from pg_trgm's plain similarity() to word_similarity(), which scores
-- "does the query appear as a word/substring within the target" instead of "how similar
-- are these two strings overall". Plain similarity() divides shared trigrams by the union
-- of ALL trigrams in both strings, so a short query ("melk") against a long, wordy product
-- name ("Arla melk hv lactofree 1lt") gets diluted by the product's other words and scores
-- low even on a perfect word match -- confirmed live: similarity('melk', that name) = 0.185,
-- BELOW the 0.2 candidate threshold, so it never even became a candidate, let alone
-- "matched" at >=0.3. word_similarity('melk', that name) = 1.0. Checked against Vomar's
-- catalog (smallest ingested chain, so the effect was most visible there): unrelated
-- products cap out at ~0.4 word_similarity for a query they don't actually contain, while
-- every genuine match scored 0.6-1.0 -- a clean gap recalibrated below (0.45 candidate
-- floor, 0.5 "matched" cutoff, replacing the old 0.2/0.3 similarity-scale numbers).
-- gin_trgm_ops (the existing products_name_trgm_idx) already supports the <%/%> word-
-- similarity operators, so this needs no new index.

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
  set local pg_trgm.word_similarity_threshold = 0.45;
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
      word_similarity(q, p.name_normalized) as score
    from products p
    join stores s on s.slug = p.chain_slug and s.active
    where p.is_active and q <% p.name_normalized
    order by score desc
    limit greatest(coalesce(p_limit, 40), 1);
end;
$$;

create or replace function get_list_item_candidates(p_list_id uuid, p_per_chain int default 6)
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
  set local pg_trgm.word_similarity_threshold = 0.45;
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
      word_similarity(i.query_name, p.name_normalized) as score
    from products p
    where p.chain_slug = s.slug
      and p.is_active
      and i.query_name <% p.name_normalized
    order by score desc
    limit greatest(coalesce(p_per_chain, 6), 1)
  ) c
  where s.active;
end;
$$;

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
  set local pg_trgm.word_similarity_threshold = 0.45;

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
        word_similarity(i.query_name, p.name_normalized)
          + case when p.tier = i.preferred_tier then 0.05 else 0 end as score
      from products p
      where p.chain_slug = s.slug
        and p.is_active
        and i.query_name <% p.name_normalized
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
    case when score >= 0.5 then product_id else null end,
    score,
    case when score >= 0.5 then 'matched'::match_status else 'no_match'::match_status end,
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
