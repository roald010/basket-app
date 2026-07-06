-- Reference/catalog tables: public read (needed by anonymous sessions), writes reserved
-- for the service role (Edge Functions use the service key, never the anon/user JWT).
alter table stores enable row level security;
create policy "stores are publicly readable" on stores for select using (true);

alter table products enable row level security;
create policy "products are publicly readable" on products for select using (true);

alter table ingredient_aliases enable row level security;
create policy "ingredient_aliases are publicly readable" on ingredient_aliases for select using (true);

alter table tier_keywords enable row level security;
create policy "tier_keywords are publicly readable" on tier_keywords for select using (true);

alter table product_ingestion_runs enable row level security;
-- No public policy: only the service role (which bypasses RLS) reads/writes this.

-- profiles
alter table profiles enable row level security;
create policy "users manage their own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- user_stores
alter table user_stores enable row level security;
create policy "users manage their own store selections" on user_stores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- staple_templates
alter table staple_templates enable row level security;
create policy "users manage their own staple templates" on staple_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- lists
alter table lists enable row level security;
create policy "users manage their own lists" on lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- recipes: ownership via parent list
alter table recipes enable row level security;
create policy "users manage recipes on their own lists" on recipes
  for all using (
    exists (select 1 from lists where lists.id = recipes.list_id and lists.user_id = auth.uid())
  ) with check (
    exists (select 1 from lists where lists.id = recipes.list_id and lists.user_id = auth.uid())
  );

-- list_items: ownership via parent list
alter table list_items enable row level security;
create policy "users manage items on their own lists" on list_items
  for all using (
    exists (select 1 from lists where lists.id = list_items.list_id and lists.user_id = auth.uid())
  ) with check (
    exists (select 1 from lists where lists.id = list_items.list_id and lists.user_id = auth.uid())
  );

-- list_item_matches: ownership via list_item -> list. match_list_items() runs as
-- SECURITY INVOKER (see its migration), so it writes under the calling user's own
-- privileges -- this policy is what actually authorizes those writes, not just reads;
-- RLS here is the real enforcement, not defense-in-depth around a definer bypass.
alter table list_item_matches enable row level security;
create policy "users manage matches for their own list items" on list_item_matches
  for all using (
    exists (
      select 1 from list_items
      join lists on lists.id = list_items.list_id
      where list_items.id = list_item_matches.list_item_id and lists.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from list_items
      join lists on lists.id = list_items.list_id
      where list_items.id = list_item_matches.list_item_id and lists.user_id = auth.uid()
    )
  );

-- store_selections: ownership via parent list
alter table store_selections enable row level security;
create policy "users manage store selections on their own lists" on store_selections
  for all using (
    exists (select 1 from lists where lists.id = store_selections.list_id and lists.user_id = auth.uid())
  ) with check (
    exists (select 1 from lists where lists.id = store_selections.list_id and lists.user_id = auth.uid())
  );
