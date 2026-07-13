// Tests for the match-probability model. Every product name here is a REAL name from the
// live catalog that a previous scoring approach got wrong (see score.ts's module comment):
// pg_trgm similarity() missed genuine matches, word_similarity() embraced junk. These lock
// in the observed failure cases as regression tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CANDIDATE_FLOOR,
  MATCH_MIN_PROBABILITY,
  contentTokens,
  diceSimilarity,
  matchProbability,
  tokenMatchStrength,
} from '../src/features/matching/score.ts';

test('contentTokens drops sizes, units, and short fragments but keeps identity words', () => {
  assert.deepEqual(contentTokens('AH Halfvolle melk 1L'), ['ah', 'halfvolle', 'melk']);
  assert.deepEqual(contentTokens('Goudse kaas jong 48+ stuk'), ['goudse', 'kaas', 'jong']);
  assert.deepEqual(contentTokens('Vrije uitloop ei wit m/l 10st'), ['vrije', 'uitloop', 'ei', 'wit']);
});

test('diceSimilarity tolerates Dutch plural stem changes', () => {
  assert.ok(diceSimilarity('tomaat', 'tomaten') >= 0.7);
  assert.ok(diceSimilarity('melk', 'milk') < 0.5); // NOT the same word
  assert.ok(diceSimilarity('passata', 'passievrucht') < 0.5);
});

test('compound rule: suffix = is the thing, prefix = is something else', () => {
  assert.equal(tokenMatchStrength('melk', 'kokosmelk'), 0.9); // kokosmelk IS melk
  assert.equal(tokenMatchStrength('melk', 'melkchocolade'), 0.35); // chocolate, not milk
  assert.equal(tokenMatchStrength('kaas', 'smeerkaas'), 0.9);
  assert.equal(tokenMatchStrength('kaas', 'kaassaus'), 0.35); // sauce, not cheese
});

test('inflection rule: short words match their plurals in both directions', () => {
  assert.equal(tokenMatchStrength('ui', 'uien'), 0.85);
  assert.equal(tokenMatchStrength('ei', 'eieren'), 0.85);
  assert.equal(tokenMatchStrength('eieren', 'ei'), 0.85);
});

test('genuine matches that pg_trgm similarity() missed now score high', () => {
  // similarity('melk', this) was 0.185 -- below every threshold. The Vomar bug.
  assert.ok(matchProbability('melk', 'Arla melk hv lactofree 1lt') >= MATCH_MIN_PROBABILITY);
  assert.ok(matchProbability('melk', 'AH Halfvolle melk 1L') >= 0.75);
  assert.ok(matchProbability('kaas', 'Feta kaas') >= 0.8);
  assert.ok(matchProbability('goudse kaas', 'Goudse kaas 48+') >= 0.9);
  assert.ok(matchProbability('passata', 'BIO+ Passata') >= 0.8);
  assert.ok(matchProbability('passata', 'Mutti passata naturel') >= MATCH_MIN_PROBABILITY);
});

test('junk that word_similarity() scored 1.0 is now rejected', () => {
  // All of these scored ~1.0 under word_similarity and appeared in real match results.
  assert.ok(matchProbability('melk', 'Whiskas Cat Milk 200 ml') < CANDIDATE_FLOOR);
  assert.ok(matchProbability('melk', 'Vaseline body milk') < CANDIDATE_FLOOR);
  assert.ok(matchProbability('melk', 'Melkunie Milk & Fruit Lichtzoet mango') < CANDIDATE_FLOOR);
  assert.ok(matchProbability('melk', 'Johnny Doodle Milk salted peanut & caramel') < CANDIDATE_FLOOR);
});

test('cross-word trigram leakage is gone: passata is not passion fruit', () => {
  // word_similarity('passata', ...) = 0.5 for all of these -- they showed up as "kinds"
  // for Passata in the live chooser (mango juice, a Bacardi cocktail, drink yoghurt).
  assert.ok(matchProbability('passata', 'Dubbeldrank Mango & passievrucht') < CANDIDATE_FLOOR);
  assert.ok(matchProbability('passata', 'Bacardi Breezer Passion fruit mango') < CANDIDATE_FLOOR);
  assert.ok(matchProbability('passata', 'Drinkyoghurt mango & passievrucht') < CANDIDATE_FLOOR);
});

test('preparations OF a thing score below the thing itself', () => {
  const plain = matchProbability('kaas', 'Goudse kaas 48+');
  const sauce = matchProbability('kaas', 'Knorr kaas saus');
  const compoundSauce = matchProbability('kaas', 'Kaassaus');
  assert.ok(sauce < plain, `sauce ${sauce} should rank below plain ${plain}`);
  assert.ok(compoundSauce < CANDIDATE_FLOOR, `kaassaus ${compoundSauce} should be dropped`);
  assert.ok(matchProbability('melk', 'Melkchocolade reep') < CANDIDATE_FLOOR);
});

test('multi-word queries require full coverage', () => {
  const full = matchProbability('halfvolle melk', 'AH Halfvolle melk 1L');
  const half = matchProbability('halfvolle melk', 'AH Volle melk 1L');
  assert.ok(full >= 0.85);
  assert.ok(half < full, `partial coverage ${half} must rank below full ${full}`);
});

test('plural query still finds singular-compound products and vice versa', () => {
  assert.ok(matchProbability('tomaten', 'Snoeptomaten 500 g') >= MATCH_MIN_PROBABILITY);
  assert.ok(matchProbability('ei', 'Bio+ ei 10 st') >= 0.8);
  assert.ok(matchProbability('ui', 'Uien los.') >= MATCH_MIN_PROBABILITY);
});

test('empty or unit-only inputs score zero', () => {
  assert.equal(matchProbability('', 'AH Halfvolle melk'), 0);
  assert.equal(matchProbability('melk', ''), 0);
  assert.equal(matchProbability('500 g', 'AH Halfvolle melk'), 0);
});
