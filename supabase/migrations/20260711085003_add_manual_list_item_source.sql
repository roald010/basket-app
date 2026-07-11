-- 'manual' covers one-off products the user adds directly to a list (List Hub's
-- "Losse producten" section) -- distinct from recipe ingredients and staple snapshots.
-- Split into its own migration file: ALTER TYPE ... ADD VALUE can't be used in the same
-- transaction as a statement that references the new value (the constraint update below).
alter type list_item_source add value if not exists 'manual';
