// Match-probability scoring: how likely is it that a catalog product IS the thing the
// user typed? This replaces raw pg_trgm scores as the app's ranking/selection signal.
//
// Why not trigram similarity? Both pg_trgm variants fail in opposite directions,
// confirmed against the live catalog:
// - similarity() divides shared trigrams by the union of ALL trigrams, so a short query
//   ("melk") against a long product name ("Arla melk hv lactofree 1lt") scores 0.185 --
//   a perfect word match, invisible below any usable threshold.
// - word_similarity() scores ~1.0 for ANY whole-word containment: "Whiskas Cat Milk",
//   "Vaseline body milk", "Knorr kaas saus" all hit 1.0 for their queries, and partial
//   extents leak across real words ("passata" vs "Bacardi Breezer Passion fruit" = 0.5).
//
// This model scores at the TOKEN level instead, with three generic signals multiplied
// into a [0,1] probability. Generic means: no grocery keyword lists -- only measurement
// units/numbers are filtered, plus small Germanic-language structure rules (compounds
// are head-final: "kokosmelk" IS a melk, "melkchocolade" is NOT; plural suffixes).
//
// 1. coverage  -- how much of the QUERY the name accounts for (each query token's best
//                 match strength across name tokens, averaged). Unmatched query tokens
//                 hurt: "halfvolle melk" against plain "melk" only half-covers.
// 2. headFactor -- the name's final content token is its head noun; if no query token
//                 matches the head (exact/compound-suffix), the product is probably a
//                 preparation OF the thing, not the thing ("Knorr kaas SAUS").
// 3. specificity -- fraction of the name's tokens the query explains. A name with many
//                 unexplained tokens is a more specific product than what was asked for;
//                 penalized gently (long honest names like "Goudse kaas jong 48+" survive).
//
// Pure and RN-free so it runs under Node's built-in test runner (tests/score.test.ts).

/** Candidates below this are dropped everywhere -- not offered as kinds, never matched.
 * Calibrated live: unrelated products cap out ~0.2-0.35 here; genuine matches score 0.55+. */
export const CANDIDATE_FLOOR = 0.4;
/** Minimum probability to persist a (item, chain) match -- below this a chain honestly
 * shows no match (the "zelf pakken" gap) rather than a guess. */
export const MATCH_MIN_PROBABILITY = 0.45;

// Measurement words carry no product identity ("500 g", "1 lt", "per stuk", "3 x").
const UNIT_WORDS = new Set([
  'g', 'gr', 'gram', 'grams', 'kg', 'kilo', 'kilogram', 'mg',
  'ml', 'cl', 'dl', 'l', 'lt', 'ltr', 'liter', 'litre',
  'st', 'stuk', 'stuks', 'x', 'per', 'ca', 'stk',
]);

// Exact plural/diminutive endings for the token-inflection rule: nt === qt + ending
// (or vice versa). Deliberately exact-concatenation only -- "kaassaus" is NOT kaas+"s"aus.
const INFLECTION_ENDINGS = ['en', 'es', 's', 'jes', 'tjes', 'eren'];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Identity-bearing tokens: lowercased, unaccented, with numbers/sizes/units dropped. */
export function contentTokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !/^\d/.test(token) && !UNIT_WORDS.has(token));
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice similarity over character bigrams -- typo/inflection tolerance
 * ("tomaat" vs "tomaten" = 0.73) without pg_trgm's cross-word leakage. */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const gram of A) if (B.has(gram)) shared += 1;
  return (2 * shared) / (A.size + B.size);
}

function isInflectionPair(shorter: string, longer: string): boolean {
  return INFLECTION_ENDINGS.some((ending) => longer === shorter + ending);
}

/** How strongly a single query token matches a single name token, in [0,1]. */
export function tokenMatchStrength(queryToken: string, nameToken: string): number {
  if (queryToken === nameToken) return 1;
  // Germanic compounds are head-final: a name token ENDING in the query token is a kind
  // of that thing ("kokosmelk" is melk, "smeerkaas" is kaas)...
  if (queryToken.length >= 3 && nameToken.length > queryToken.length && nameToken.endsWith(queryToken)) return 0.9;
  // ...while plural/diminutive inflections keep identity ("ui" -> "uien", "ei" -> "eieren").
  if (isInflectionPair(queryToken, nameToken) || isInflectionPair(nameToken, queryToken)) return 0.85;
  // A name token STARTING with the query token has a different head -- the query word is
  // only a modifier ("melkchocolade" is chocolate, "kaassaus" is a sauce). Weak.
  if (queryToken.length >= 3 && nameToken.length > queryToken.length && nameToken.startsWith(queryToken)) return 0.35;
  // Fuzzy fallback for typos and stem changes ("tomaat"/"tomaten").
  const dice = diceSimilarity(queryToken, nameToken);
  if (dice >= 0.7) return 0.9 * dice;
  return 0;
}

/**
 * Probability-like score in [0,1] that the product named `name` is what the user meant
 * by `query`. See the module comment for the model; ~0.8+ = plain product match,
 * ~0.5-0.7 = plausible variant/preparation, <CANDIDATE_FLOOR = unrelated.
 */
export function matchProbability(query: string, name: string): number {
  const queryTokens = contentTokens(query);
  const nameTokens = contentTokens(name);
  if (queryTokens.length === 0 || nameTokens.length === 0) return 0;

  let coverageSum = 0;
  for (const queryToken of queryTokens) {
    let best = 0;
    for (const nameToken of nameTokens) {
      const strength = tokenMatchStrength(queryToken, nameToken);
      if (strength > best) best = strength;
      if (best === 1) break;
    }
    coverageSum += best;
  }
  const coverage = coverageSum / queryTokens.length;
  if (coverage === 0) return 0;

  const head = nameTokens[nameTokens.length - 1];
  const headMatched = queryTokens.some((queryToken) => tokenMatchStrength(queryToken, head) >= 0.85);
  const headFactor = headMatched ? 1 : 0.72;

  const matchedNameCount = nameTokens.filter((nameToken) =>
    queryTokens.some((queryToken) => tokenMatchStrength(queryToken, nameToken) >= 0.5)
  ).length;
  const specificity = matchedNameCount / nameTokens.length;
  const specificityFactor = 0.75 + 0.25 * specificity;

  return Math.min(1, coverage * headFactor * specificityFactor);
}
