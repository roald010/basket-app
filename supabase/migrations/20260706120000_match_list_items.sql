-- Matching engine (M5), first slice: match_list_items(list_id) fuzzy-matches every
-- list_item in a list against each active chain's product catalog, and upserts one row
-- per (list_item, chain) into list_item_matches. Store-combination optimization
-- (1/2/3-store comparison, store_selections) is a later slice -- this only produces the
-- per-chain match data that slice will read.
--
-- SECURITY INVOKER (not DEFINER): runs under the calling user's own privileges, so the
-- RLS policy on list_item_matches (see rls_policies.sql) is what actually authorizes the
-- writes -- this function has no elevated access of its own.
create or replace function match_list_items(p_list_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_shopper_tier shopper_tier;
  v_preferred_tier product_tier;
begin
  -- Candidate retrieval bar (loose, uses the trgm GIN index via the `%` operator).
  -- The tighter 0.3 bar below decides matched vs. no_match.
  set local pg_trgm.similarity_threshold = 0.2;

  select shopper_tier into v_shopper_tier from profiles where id = auth.uid();
  v_preferred_tier := case v_shopper_tier
    when 'budget' then 'budget'::product_tier
    when 'premium' then 'premium'::product_tier
    else 'standard'::product_tier
  end;

  with items as (
    select
      li.id as list_item_id,
      lower(unaccent(coalesce(a.canonical_name, li.name))) as query_name
    from list_items li
    left join lateral (
      -- ingredient_aliases has no wildcards stored -- match it as a substring of the
      -- item name (e.g. alias "ui" matches item name "rode ui") and prefer the
      -- longest/most specific alias when more than one substring-matches.
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
          + case when p.tier = v_preferred_tier then 0.05 else 0 end as score
      from products p
      where p.chain_slug = s.slug
        and p.is_active
        and p.name_normalized % i.query_name
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
    computed_at = excluded.computed_at;
end;
$$;

-- The client (List Hub) calls this via supabase.rpc() as the signed-in (anonymous or
-- upgraded) user -- that JWT carries the `authenticated` role, not `anon`.
grant execute on function match_list_items(uuid) to authenticated;
