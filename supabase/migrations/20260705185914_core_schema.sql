-- profiles: 1:1 with auth.users
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'nl',
  shopper_tier shopper_tier not null default 'balans',
  home_lat double precision,
  home_lng double precision,
  location_updated_at timestamptz,
  created_at timestamptz not null default now()
);

-- stores: seeded reference data, not derived from any ingested catalog.
-- No brand color column by design -- the UI never renders real chain brand colors,
-- only neutral grey monograms with green reserved for "cheapest/selected".
create table stores (
  slug text primary key,
  display_name text not null,
  monogram text not null,
  active boolean not null default true
);

create table user_stores (
  user_id uuid not null references auth.users (id) on delete cascade,
  chain_slug text not null references stores (slug),
  position int not null default 0,
  primary key (user_id, chain_slug)
);

-- staple_templates: the user's recurring items, edited on the "Altijd erbij" screen.
-- list_items snapshots these at list-creation time rather than linking live,
-- so editing a template later doesn't rewrite historical lists.
create table staple_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  default_quantity numeric not null default 1,
  unit text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Weekmenu',
  include_staples boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists (id) on delete cascade,
  name text not null,
  source_type text not null default 'text',
  original_text text,
  servings_source int,
  servings_target int,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- list_items unifies recipe ingredients and staple rows into the single stream
-- Compare and Shopping mode both iterate over.
create table list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists (id) on delete cascade,
  source_type list_item_source not null,
  recipe_id uuid references recipes (id) on delete cascade,
  staple_template_id uuid references staple_templates (id) on delete set null,
  name text not null,
  quantity numeric,
  unit text,
  is_manually_edited boolean not null default false,
  assigned_chain_slug text references stores (slug),
  is_checked boolean not null default false,
  checked_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint list_items_source_ref_check check (
    (source_type = 'recipe' and recipe_id is not null)
    or (source_type = 'staple' and staple_template_id is not null)
  )
);

create index list_items_list_id_idx on list_items (list_id);
create index list_items_recipe_id_idx on list_items (recipe_id);

-- products: the ingested per-chain catalog. Populated by the ingest-checkjebon
-- Edge Function today; designed so a future custom scraper can write into this
-- same shape (chain_slug, source_id, name, raw_size, price) via the same upsert contract.
create table products (
  id bigserial primary key,
  chain_slug text not null references stores (slug),
  source_id text not null,
  name text not null,
  -- Not a GENERATED column: unaccent(text) is STABLE, not IMMUTABLE (it depends on the
  -- current search-path text search config), so Postgres rejects it in a generated
  -- expression. Populated explicitly by the ingest-checkjebon Edge Function instead,
  -- which already normalizes name/unit/tier at ingestion time.
  name_normalized text not null,
  raw_size text,
  parsed_quantity numeric,
  unit_type unit_type,
  parsed_unit text,
  price numeric(10, 2) not null,
  price_per_base_unit numeric,
  tier product_tier,
  is_active boolean not null default true,
  ingested_at timestamptz not null default now(),
  unique (chain_slug, source_id)
);

create index products_name_trgm_idx on products using gin (name_normalized extensions.gin_trgm_ops);
create index products_name_tsv_idx on products using gin (to_tsvector('simple', name));
create index products_chain_active_idx on products (chain_slug, is_active);

create table product_ingestion_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_ingested int,
  rows_deactivated int,
  status ingestion_status not null default 'running',
  error_message text
);

-- One row per (list_item, candidate chain) -- not a single column on list_items --
-- because Compare needs a per-chain price to rank 1/2/3-store combinations, and an
-- item can match at one chain but not another.
create table list_item_matches (
  id bigserial primary key,
  list_item_id uuid not null references list_items (id) on delete cascade,
  chain_slug text not null references stores (slug),
  matched_product_id bigint references products (id),
  match_confidence numeric,
  match_status match_status not null,
  computed_at timestamptz not null default now(),
  unique (list_item_id, chain_slug)
);

create index list_item_matches_item_idx on list_item_matches (list_item_id);

create table store_selections (
  id bigserial primary key,
  list_id uuid not null unique references lists (id) on delete cascade,
  store_count int not null,
  chosen_chains text[] not null,
  total_price numeric not null,
  baseline_single_store_total numeric,
  decided_at timestamptz not null default now()
);

-- Small tunable config tables backing the matching engine (see match_list_items).
create table ingredient_aliases (
  id bigserial primary key,
  alias text not null,
  canonical_name text not null,
  created_at timestamptz not null default now()
);

create table tier_keywords (
  id bigserial primary key,
  tier product_tier not null,
  keyword text not null,
  created_at timestamptz not null default now()
);
