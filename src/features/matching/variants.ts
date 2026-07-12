// Standardizes the raw product candidates for a list item (from the get_list_item_candidates
// RPC) into a SMALL set of store-agnostic "kinds" the user can choose from -- e.g. a big
// block of cheese to grate from vs. small blocks, both sold at many chains. Grouping is by
// SIZE (per the product's unit_type + a size band); form differences (block vs grated) fall
// out naturally because they carry different names and produce different labels.
//
// Pure and RN-free (no imports) so it runs under Node's built-in test runner with
// type-stripping, exactly like optimize.ts. All heuristics live here and are unit-tested.

export type UnitType = 'mass' | 'volume' | 'count';

/** One matched product, as returned (camel-cased) by get_list_item_candidates. */
export type ProductCandidate = {
  productId: number;
  chainSlug: string;
  name: string;
  parsedQuantity: number | null;
  parsedUnit: string | null;
  unitType: UnitType | null;
  price: number;
  tier: 'budget' | 'standard' | 'premium' | null;
  score: number;
};

/** A standardized, store-agnostic choice presented to the user. */
export type ProductKind = {
  /** Human label, e.g. "Halfvolle melk · ~1 L". */
  label: string;
  /** Representative normalized name to persist as list_items.variant_query. */
  query: string;
  unitType: UnitType;
  /** Observed size band in the base unit (g / ml / piece), inclusive. */
  sizeMin: number;
  sizeMax: number;
  /** How many distinct chains carry this kind -- drives "in N winkels". */
  chainCount: number;
  /** Cheapest price seen for this kind ("vanaf €X"). */
  fromPrice: number;
  /** Mean trigram-similarity score of the candidates behind this kind -- how well it
   * matches what the user actually typed, independent of how many chains carry it.
   * Drives both the "most likely first" ordering and needsKindChoice()'s ambiguity check. */
  confidence: number;
};

const MAX_KINDS = 4;

// A kind's confidence must clear this to count as a plausible reading of the typed name at
// all -- mirrors match_list_items()'s own 0.3 "matched" cutoff, so "barely resembles it"
// candidates can't force a choice.
const MIN_PLAUSIBLE_CONFIDENCE = 0.3;
// How close the top two kinds' confidence must be to count as genuine doubt. Below this gap,
// the top kind is a clearly better guess and no user decision is needed.
const CONFIDENCE_GAP_THRESHOLD = 0.1;

// Convert a product's original unit to its base unit (gram / milliliter / piece) so sizes
// are comparable within a unit_type -- mirrors the ingest function's unit factors.
const UNIT_TO_BASE: Record<string, number> = {
  g: 1, gr: 1, gram: 1, grm: 1, kg: 1000, kilo: 1000, kilogram: 1000,
  ml: 1, milliliter: 1, mililiters: 1, cl: 10, centiliter: 10, l: 1000, liter: 1000,
  stuk: 1, stuks: 1, st: 1,
};

// Size-band cut points per unit_type, in the base unit. A band is [previous, cut).
const BANDS: Record<UnitType, number[]> = {
  mass: [250, 750], // < 250 g | 250-750 g | > 750 g
  volume: [500, 1500], // < 500 ml | 500-1500 ml | > 1500 ml
  count: [2, 7], // 1 | 2-6 | 7+
};

// Tokens that never help name a kind: chain names, size/unit words, pure fillers.
const STOP_TOKENS = new Set<string>([
  'ah', 'jumbo', 'lidl', 'plus', 'aldi', 'dirk', 'spar', 'vomar', 'dekamarkt', 'hoogvliet',
  'poiesz', 'ekoplaza', 'coop', 'jan', 'linders', 'boni', 'bio', 'biologisch', 'per', 'ca',
  'g', 'gr', 'gram', 'kg', 'ml', 'cl', 'l', 'liter', 'stuk', 'stuks', 'st', 'x', 'de', 'het',
  'van', 'en',
]);

function baseQuantity(candidate: ProductCandidate): number | null {
  if (candidate.parsedQuantity == null || candidate.unitType == null || !candidate.parsedUnit) return null;
  const factor = UNIT_TO_BASE[candidate.parsedUnit.toLowerCase()];
  if (!factor) return null;
  const base = candidate.parsedQuantity * factor;
  return base > 0 ? base : null;
}

function bandIndex(unitType: UnitType, base: number): number {
  const cuts = BANDS[unitType];
  let i = 0;
  while (i < cuts.length && base >= cuts[i]) i += 1;
  return i;
}

/** A short, readable size label for the middle of a band, e.g. "~500 g", "~1 L", "6 st". */
function sizeLabel(unitType: UnitType, sizeMin: number, sizeMax: number): string {
  const mid = Math.round((sizeMin + sizeMax) / 2);
  if (unitType === 'count') return mid <= 1 ? 'per stuk' : `~${mid} st`;
  if (unitType === 'mass') return mid >= 1000 ? `~${round1(mid / 1000)} kg` : `~${mid} g`;
  return mid >= 1000 ? `~${round1(mid / 1000)} L` : `~${mid} ml`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The most common 1-2 meaningful tokens across a band's product names, used both as the
// display name and the re-match query -- store/brand tokens rank below the shared ones.
function representativeName(candidates: ProductCandidate[]): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const candidate of candidates) {
    const seen = new Set<string>();
    for (const raw of candidate.name.toLowerCase().split(/[^a-zà-ÿ]+/)) {
      const token = raw.trim();
      if (token.length < 2 || STOP_TOKENS.has(token) || seen.has(token)) continue;
      seen.add(token);
      if (!counts.has(token)) order.push(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  const ranked = order
    .sort((a, b) => (counts.get(b)! - counts.get(a)!) || order.indexOf(a) - order.indexOf(b))
    .slice(0, 2);
  return ranked.join(' ');
}

/**
 * Collapses candidates into up to MAX_KINDS store-agnostic kinds, ranked by how many chains
 * carry them (breadth) then price. Returns [] or a single kind when there's nothing to
 * disambiguate -- callers treat `length > 1` as "ask the user to choose".
 */
export function standardizeVariants(candidates: ProductCandidate[]): ProductKind[] {
  const groups = new Map<string, { unitType: UnitType; items: ProductCandidate[]; bases: number[] }>();

  for (const candidate of candidates) {
    if (candidate.unitType == null) continue;
    const base = baseQuantity(candidate);
    if (base == null) continue; // only offer kinds we can actually characterize by size
    const key = `${candidate.unitType}:${bandIndex(candidate.unitType, base)}`;
    const group = groups.get(key) ?? { unitType: candidate.unitType, items: [], bases: [] };
    group.items.push(candidate);
    group.bases.push(base);
    groups.set(key, group);
  }

  const kinds: ProductKind[] = [];
  for (const group of groups.values()) {
    const sizeMin = Math.min(...group.bases);
    const sizeMax = Math.max(...group.bases);
    const chainCount = new Set(group.items.map((item) => item.chainSlug)).size;
    const fromPrice = Math.min(...group.items.map((item) => item.price));
    const confidence = group.items.reduce((sum, item) => sum + item.score, 0) / group.items.length;
    const nameTokens = representativeName(group.items);
    const namePart = nameTokens ? titleCase(nameTokens) : 'Product';
    kinds.push({
      label: `${namePart} · ${sizeLabel(group.unitType, sizeMin, sizeMax)}`,
      query: nameTokens,
      unitType: group.unitType,
      sizeMin,
      sizeMax,
      chainCount,
      fromPrice,
      confidence,
    });
  }

  // Most-likely-first: confidence (how well it matches what was typed) is the primary
  // signal, not chain breadth -- a widely-stocked but poorly-matching kind shouldn't
  // outrank a kind that's clearly what the user meant. Breadth and price only break ties.
  const ranked = kinds.sort(
    (a, b) => b.confidence - a.confidence || b.chainCount - a.chainCount || a.fromPrice - b.fromPrice
  );
  // Prefer kinds carried by multiple chains -- the "available at many supermarkets" promise,
  // and it drops one-off noise (a lone product at a single chain). Only fall back to
  // single-chain kinds when there aren't at least two broadly-available ones.
  const broad = ranked.filter((kind) => kind.chainCount >= 2);
  return (broad.length >= 2 ? broad : ranked).slice(0, MAX_KINDS);
}

/**
 * True only when there's genuine doubt about which kind the user meant: at least two kinds
 * are both plausible readings of the typed name (confidence >= MIN_PLAUSIBLE_CONFIDENCE) and
 * neither clearly beats the other. When one kind is a clearly better guess, no user decision
 * is needed -- match_list_items() already resolves it via its own scoring. `kinds` must be
 * standardizeVariants()'s output (confidence-sorted); only the top two are compared.
 */
export function needsKindChoice(kinds: ProductKind[]): boolean {
  if (kinds.length < 2) return false;
  const [top, runnerUp] = kinds;
  if (runnerUp.confidence < MIN_PLAUSIBLE_CONFIDENCE) return false;
  return top.confidence - runnerUp.confidence <= CONFIDENCE_GAP_THRESHOLD;
}
