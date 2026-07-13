-- Move match SELECTION to the client; SQL keeps only candidate RECALL.
--
-- Neither pg_trgm scoring mode can rank products reliably (similarity() buries genuine
-- matches under long-name dilution; word_similarity() scores any whole-word containment
-- ~1.0, so "Whiskas Cat Milk" matched "melk" and "Bacardi Breezer Passion fruit" became a
-- kind of "passata" -- both observed live). The app now scores candidates with a token-
-- level probability model in TypeScript (src/features/matching/score.ts, unit-tested),
-- and writes list_item_matches itself -- RLS already authorizes those writes via list
-- ownership, which is exactly how the old SECURITY INVOKER function was authorized too.
--
-- get_list_item_candidates therefore becomes a generous recall query: a LOW
-- word_similarity floor (0.3) purely to keep the index-backed candidate set small, more
-- rows per chain, and it now returns the resolved query_name so the client can score
-- against the same string the alias resolution produced.

drop function if exists get_list_item_candidates(uuid, int);

create function get_list_item_candidates(p_list_id uuid, p_per_chain int default 12)
returns table (
  list_item_id uuid,
  query_name text,
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
  set local pg_trgm.word_similarity_threshold = 0.3;
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
    i.query_name,
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
    limit greatest(coalesce(p_per_chain, 12), 1)
  ) c
  where s.active;
end;
$$;

grant execute on function get_list_item_candidates(uuid, int) to authenticated;

-- The SQL matcher is superseded by client-side selection (same scoring as the chooser and
-- the persisted prices -- one brain). Dropped rather than left behind so nothing can call
-- the worse of two matching implementations by accident.
drop function if exists match_list_items(uuid);
