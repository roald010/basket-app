// Ingests the checkjebon.nl open dataset (https://github.com/supermarkt/checkjebon)
// into `products`, so match_list_items() has a real catalog instead of the hand-seeded
// rows in seed.sql. Meant to run daily (see .github/workflows/ingest-checkjebon.yml),
// not to be called from the app -- only service-role callers are accepted (checked
// below), even though Supabase's platform-level verify_jwt already requires *some*
// valid project JWT before this handler runs at all.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CHECKJEBON_URL = 'https://raw.githubusercontent.com/supermarkt/checkjebon/main/data/supermarkets.json';
// Chunked so each upsert stays well under PostgREST's request size/row limits --
// ~107k products total across all chains as of 2026-07.
const UPSERT_BATCH_SIZE = 1000;

type RawProduct = { n: string; l: string; p: number; s: string };
type RawChain = { n: string; d: RawProduct[] };

type ParsedSize = { quantity: number | null; unitType: 'mass' | 'volume' | 'count' | null; unit: string | null };

// Factor to convert each recognized unit into its base (gram, milliliter, or piece).
const MASS_UNITS_TO_GRAM: Record<string, number> = { g: 1, gr: 1, gram: 1, grm: 1, kg: 1000, kilo: 1000, kilogram: 1000 };
const VOLUME_UNITS_TO_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  mililiters: 1,
  cl: 10,
  centiliter: 10,
  l: 1000,
  liter: 1000,
};
const COUNT_UNITS = new Set(['stuks', 'stuk', 'st']);

/** Same accent-stripping intent as Postgres unaccent(), done in JS since this table's
 * name_normalized column is populated at ingestion time, not as a generated column
 * (see core_schema.sql -- unaccent() there is STABLE, not IMMUTABLE). */
const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .trim();
}

function resolveUnit(quantity: number, unit: string): ParsedSize {
  if (unit in MASS_UNITS_TO_GRAM) return { quantity, unitType: 'mass', unit };
  if (unit in VOLUME_UNITS_TO_ML) return { quantity, unitType: 'volume', unit };
  if (COUNT_UNITS.has(unit)) return { quantity, unitType: 'count', unit };
  return { quantity: null, unitType: null, unit: null };
}

/** Best-effort parse of checkjebon's free-text size field -- e.g. "500 g", "0,75 l",
 * "4 x 0,5 l", "per stuk". Covers the ~40 patterns that make up the bulk of the
 * dataset; anything else is left null (both columns are nullable). */
function parseSize(raw: string): ParsedSize {
  if (!raw) return { quantity: null, unitType: null, unit: null };
  const cleaned = raw
    .toLowerCase()
    .replace(/^per\s+/, '')
    .replace(/^ca\.\s*/, '')
    .trim();

  const multi = cleaned.match(/^(\d+)\s*x\s*([\d,.]+)\s*([a-z]+)/);
  if (multi) {
    const count = parseFloat(multi[1]);
    const size = parseFloat(multi[2].replace(',', '.'));
    return resolveUnit(count * size, multi[3]);
  }

  const single = cleaned.match(/^([\d,.]+)\s*([a-z]+)/);
  if (single) {
    return resolveUnit(parseFloat(single[1].replace(',', '.')), single[2]);
  }

  if (cleaned.includes('stuk')) return { quantity: 1, unitType: 'count', unit: 'stuk' };

  return { quantity: null, unitType: null, unit: null };
}

/** €/kg, €/l, or €/piece -- null when the size couldn't be parsed. */
function pricePerBaseUnit(price: number, parsed: ParsedSize): number | null {
  if (parsed.quantity == null || parsed.unit == null) return null;
  let baseQuantity: number;
  if (parsed.unitType === 'mass') baseQuantity = (parsed.quantity * MASS_UNITS_TO_GRAM[parsed.unit]) / 1000;
  else if (parsed.unitType === 'volume') baseQuantity = (parsed.quantity * VOLUME_UNITS_TO_ML[parsed.unit]) / 1000;
  else baseQuantity = parsed.quantity;
  if (baseQuantity <= 0) return null;
  return Math.round((price / baseQuantity) * 100) / 100;
}

function classifyTier(normalizedName: string, budgetKeywords: string[], premiumKeywords: string[]): 'budget' | 'standard' | 'premium' {
  if (budgetKeywords.some((keyword) => normalizedName.includes(keyword))) return 'budget';
  if (premiumKeywords.some((keyword) => normalizedName.includes(keyword))) return 'premium';
  return 'standard';
}

/** Supabase's edge gateway already verified this is a validly signed project JWT
 * (default verify_jwt=true) -- this just narrows further to service-role callers,
 * since ingestion is meant to run from the scheduled workflow, never the app. */
function isServiceRoleToken(authHeader: string | null): boolean {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const payloadSegment = token.split('.')[1];
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  if (!isServiceRoleToken(req.headers.get('authorization'))) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: run, error: runError } = await supabase
    .from('product_ingestion_runs')
    .insert({ status: 'running' })
    .select('id, started_at')
    .single();
  if (runError || !run) {
    console.error('ingest-checkjebon: failed to create run row', runError);
    return new Response(JSON.stringify({ error: 'Failed to start ingestion run' }), { status: 500 });
  }

  try {
    const [{ data: stores, error: storesError }, { data: tierKeywords, error: keywordsError }] = await Promise.all([
      supabase.from('stores').select('slug').eq('active', true),
      supabase.from('tier_keywords').select('tier, keyword'),
    ]);
    if (storesError) throw storesError;
    if (keywordsError) throw keywordsError;

    const storeSlugs = new Set((stores ?? []).map((store) => store.slug));
    const budgetKeywords = (tierKeywords ?? []).filter((k) => k.tier === 'budget').map((k) => k.keyword.toLowerCase());
    const premiumKeywords = (tierKeywords ?? []).filter((k) => k.tier === 'premium').map((k) => k.keyword.toLowerCase());

    const res = await fetch(CHECKJEBON_URL);
    if (!res.ok) throw new Error(`Failed to fetch checkjebon dataset: HTTP ${res.status}`);
    const chains: RawChain[] = await res.json();

    const runStartedAt = run.started_at as string;
    let rowsIngested = 0;

    for (const chain of chains) {
      if (!storeSlugs.has(chain.n)) {
        // Either a chain checkjebon hasn't published data for yet (see aldi/ekoplaza,
        // both return an empty `d` today), or a genuine slug drift worth investigating --
        // not fatal either way, so log and move on rather than failing the whole run.
        console.warn(`ingest-checkjebon: skipping unmatched chain slug "${chain.n}"`);
        continue;
      }

      const rows = chain.d.map((product) => {
        const nameNormalized = normalizeName(product.n);
        const parsedSize = parseSize(product.s);
        return {
          chain_slug: chain.n,
          source_id: product.l,
          name: product.n,
          name_normalized: nameNormalized,
          raw_size: product.s || null,
          parsed_quantity: parsedSize.quantity,
          unit_type: parsedSize.unitType,
          parsed_unit: parsedSize.unit,
          price: product.p,
          price_per_base_unit: pricePerBaseUnit(product.p, parsedSize),
          tier: classifyTier(nameNormalized, budgetKeywords, premiumKeywords),
          is_active: true,
          ingested_at: runStartedAt,
        };
      });

      for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
        const { error } = await supabase.from('products').upsert(batch, { onConflict: 'chain_slug,source_id' });
        if (error) throw new Error(`Upsert failed for chain "${chain.n}": ${error.message}`);
        rowsIngested += batch.length;
      }
    }

    // Anything not touched by this run's upserts has disappeared from the source --
    // deactivate rather than delete, so historical list_item_matches still resolve.
    const { count: rowsDeactivated, error: deactivateError } = await supabase
      .from('products')
      .update({ is_active: false }, { count: 'exact' })
      .lt('ingested_at', runStartedAt)
      .eq('is_active', true);
    if (deactivateError) throw new Error(`Deactivation failed: ${deactivateError.message}`);

    await supabase
      .from('product_ingestion_runs')
      .update({
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        rows_ingested: rowsIngested,
        rows_deactivated: rowsDeactivated ?? 0,
      })
      .eq('id', run.id);

    return new Response(JSON.stringify({ rowsIngested, rowsDeactivated: rowsDeactivated ?? 0 }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('ingest-checkjebon failed', error);
    await supabase
      .from('product_ingestion_runs')
      .update({ status: 'failed', finished_at: new Date().toISOString(), error_message: String(error) })
      .eq('id', run.id);
    return new Response(JSON.stringify({ error: 'Ingestion failed' }), { status: 500 });
  }
});
