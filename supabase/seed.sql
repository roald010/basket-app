-- Seed the 12 chains present in the checkjebon dataset (raw/data/supermarkets.json).
-- Display names and monograms are curated here since the source data only has slugs.
insert into stores (slug, display_name, monogram) values
  ('ah', 'Albert Heijn', 'AH'),
  ('jumbo', 'Jumbo', 'Ju'),
  ('plus', 'Plus', 'Pl'),
  ('dirk', 'Dirk', 'Di'),
  ('lidl', 'Lidl', 'Li'),
  ('aldi', 'Aldi', 'Al'),
  ('dekamarkt', 'DekaMarkt', 'DM'),
  ('ekoplaza', 'Ekoplaza', 'Ek'),
  ('hoogvliet', 'Hoogvliet', 'Hv'),
  ('poiesz', 'Poiesz', 'Po'),
  ('spar', 'Spar', 'Sp'),
  ('vomar', 'Vomar', 'Vo')
on conflict (slug) do nothing;

-- A minimal starting set of tier keywords for the matching engine (M5). Curated and
-- expected to grow -- see the "tier classification is a heuristic" risk noted in the plan.
insert into tier_keywords (tier, keyword) values
  ('budget', 'huismerk'),
  ('budget', 'basic'),
  ('budget', 'euro shopper'),
  ('budget', 'budget'),
  ('premium', 'biologisch'),
  ('premium', 'bio'),
  ('premium', 'ambachtelijk'),
  ('premium', 'dop'),
  ('premium', 'ggo');

-- A handful of common-ingredient aliases so match_list_items() has something to resolve
-- besides an exact name match -- expected to grow alongside tier_keywords above.
insert into ingredient_aliases (alias, canonical_name) values
  ('ui', 'uien'),
  ('kipfilet', 'kipfilet'),
  ('melk', 'halfvolle melk'),
  ('ei', 'eieren'),
  ('tomaat', 'tomaten');

-- A small hand-picked product catalog across two chains, standing in for the
-- ingest-checkjebon Edge Function until that lands -- enough to exercise
-- match_list_items() end to end for local/dev testing.
insert into products (chain_slug, source_id, name, name_normalized, price, tier, is_active) values
  ('ah', 'seed-ui-1', 'AH Uien 1kg', 'ah uien 1kg', 1.19, 'standard', true),
  ('ah', 'seed-ui-2', 'AH Biologische uien 500g', 'ah biologische uien 500g', 1.89, 'premium', true),
  ('ah', 'seed-kip-1', 'AH Kipfilet naturel 300g', 'ah kipfilet naturel 300g', 4.29, 'standard', true),
  ('ah', 'seed-melk-1', 'AH Halfvolle melk 1L', 'ah halfvolle melk 1l', 1.29, 'standard', true),
  ('ah', 'seed-ei-1', 'AH Eieren 10 stuks', 'ah eieren 10 stuks', 2.49, 'standard', true),
  ('ah', 'seed-tom-1', 'AH Tomaten los', 'ah tomaten los', 2.99, 'standard', true),
  ('jumbo', 'seed-ui-1', 'Jumbo Uien huismerk 1kg', 'jumbo uien huismerk 1kg', 0.99, 'budget', true),
  ('jumbo', 'seed-kip-1', 'Jumbo Kipfilet 300g', 'jumbo kipfilet 300g', 3.99, 'standard', true),
  ('jumbo', 'seed-melk-1', 'Jumbo Halfvolle melk 1L', 'jumbo halfvolle melk 1l', 1.15, 'standard', true),
  ('jumbo', 'seed-tom-1', 'Jumbo Tomaten 500g', 'jumbo tomaten 500g', 1.79, 'standard', true)
on conflict (chain_slug, source_id) do nothing;
