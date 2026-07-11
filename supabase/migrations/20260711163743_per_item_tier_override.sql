-- Per-item shopper-tier override (task #35): the profile's shopper_tier only ever
-- nudged matching toward one tier for the WHOLE list (a soft +0.05 similarity bonus in
-- match_list_items). This lets a single item opt out of that default and pick its own
-- tier -- e.g. always buy budget rice but premium olive oil, regardless of profile.
alter table list_items add column tier_override product_tier;

-- Re-create match_list_items to resolve the preferred tier PER ITEM
-- (coalesce(li.tier_override, profile default)) instead of once for the whole list.
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
      lower(unaccent(coalesce(a.canonical_name, li.name))) as query_name
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

grant execute on function match_list_items(uuid) to authenticated;
