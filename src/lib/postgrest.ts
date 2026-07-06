/**
 * Normalizes a PostgREST embedded relation down to a single row.
 *
 * supabase-js (without a generated `Database` type) infers *every* embedded relation as
 * an array. But PostgREST returns a single JSON object -- not a one-element array -- for
 * a many-to-one embed, i.e. when the current row holds the foreign key (here:
 * list_item_matches.matched_product_id -> products.id). Indexing `[0]` on that object
 * yields `undefined` at runtime even though it type-checks, silently dropping the value.
 *
 * This collapses both shapes (object | array | null) to `T | null` safely.
 */
export function embeddedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}
