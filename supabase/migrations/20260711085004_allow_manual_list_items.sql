-- Manual rows have neither a recipe_id nor a staple_template_id.
alter table list_items drop constraint list_items_source_ref_check;
alter table list_items add constraint list_items_source_ref_check check (
  (source_type = 'recipe' and recipe_id is not null)
  or (source_type = 'staple' and staple_template_id is not null)
  or (source_type = 'manual' and recipe_id is null and staple_template_id is null)
);
