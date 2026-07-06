-- Extensions used by ingredient/product name matching (trigram similarity, accent-insensitive search).
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Shared enums.
create type shopper_tier as enum ('budget', 'balans', 'premium');
create type product_tier as enum ('budget', 'standard', 'premium');
create type unit_type as enum ('mass', 'volume', 'count');
create type list_item_source as enum ('recipe', 'staple');
create type match_status as enum ('matched', 'no_match');
create type ingestion_status as enum ('running', 'succeeded', 'failed');
