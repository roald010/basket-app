// Tests for the pure product-"kind" standardizer. Runs under Node's built-in test runner
// with type-stripping (see package.json "test") -- no test-framework dependency.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standardizeVariants, type ProductCandidate } from '../src/features/matching/variants.ts';

function candidate(partial: Partial<ProductCandidate>): ProductCandidate {
  return {
    productId: 1,
    chainSlug: 'ah',
    name: 'Product',
    parsedQuantity: null,
    parsedUnit: null,
    unitType: null,
    price: 1,
    tier: null,
    score: 0.5,
    ...partial,
  };
}

test('no candidates yields no kinds', () => {
  assert.deepEqual(standardizeVariants([]), []);
});

test('candidates without a parseable size are dropped', () => {
  const kinds = standardizeVariants([
    candidate({ name: 'Kaas', parsedQuantity: null, parsedUnit: null, unitType: null }),
    candidate({ name: 'Kaas', parsedQuantity: 200, parsedUnit: 'g', unitType: 'mass', chainSlug: 'ah' }),
  ]);
  assert.equal(kinds.length, 1); // only the sized one becomes a kind
});

test('a single kind is returned (caller treats length<=1 as not ambiguous)', () => {
  const kinds = standardizeVariants([
    candidate({ name: 'AH Halfvolle melk 1 l', parsedQuantity: 1, parsedUnit: 'l', unitType: 'volume', chainSlug: 'ah' }),
  ]);
  assert.equal(kinds.length, 1);
  assert.equal(kinds[0].unitType, 'volume');
  assert.match(kinds[0].label, /~1 L/);
});

test('the cheese example splits into distinct size kinds, ranked by chain breadth', () => {
  const kinds = standardizeVariants([
    // small block (150 g) at 2 chains
    candidate({ productId: 1, chainSlug: 'ah', name: 'AH Goudse kaas 150 g', parsedQuantity: 150, parsedUnit: 'g', unitType: 'mass', price: 1.9 }),
    candidate({ productId: 2, chainSlug: 'jumbo', name: 'Jumbo Goudse kaas 150 g', parsedQuantity: 150, parsedUnit: 'g', unitType: 'mass', price: 2.1 }),
    // big block (500 g) at 3 chains
    candidate({ productId: 3, chainSlug: 'ah', name: 'AH Goudse kaas 500 g', parsedQuantity: 500, parsedUnit: 'g', unitType: 'mass', price: 5.2 }),
    candidate({ productId: 4, chainSlug: 'jumbo', name: 'Jumbo Goudse kaas 500 g', parsedQuantity: 500, parsedUnit: 'g', unitType: 'mass', price: 4.9 }),
    candidate({ productId: 5, chainSlug: 'lidl', name: 'Lidl Goudse kaas 500 g', parsedQuantity: 500, parsedUnit: 'g', unitType: 'mass', price: 4.5 }),
  ]);
  assert.equal(kinds.length, 2);
  // big block carried by 3 chains ranks first
  assert.equal(kinds[0].chainCount, 3);
  assert.match(kinds[0].label, /Goudse kaas/); // brand tokens (ah/jumbo/lidl) drop out
  assert.match(kinds[0].label, /~500 g/);
  assert.equal(kinds[0].fromPrice, 4.5);
  assert.equal(kinds[1].chainCount, 2);
  assert.match(kinds[1].label, /~150 g/);
});

test('sizes are normalized to a base unit before banding (1 kg != 1 g)', () => {
  const kinds = standardizeVariants([
    candidate({ productId: 1, chainSlug: 'ah', name: 'Rijst 500 g', parsedQuantity: 500, parsedUnit: 'g', unitType: 'mass', price: 1.0 }),
    candidate({ productId: 2, chainSlug: 'jumbo', name: 'Rijst 1 kg', parsedQuantity: 1, parsedUnit: 'kg', unitType: 'mass', price: 1.8 }),
  ]);
  // 500 g -> 500 (band "medium"); 1 kg -> 1000 (band "large") => two distinct kinds
  assert.equal(kinds.length, 2);
  const labels = kinds.map((k) => k.label);
  assert.ok(labels.some((l) => /~500 g/.test(l)), labels.join(' | '));
  assert.ok(labels.some((l) => /~1 kg/.test(l)), labels.join(' | '));
});

test('kinds are capped at four', () => {
  const cands: ProductCandidate[] = [];
  // 6 distinct count-bands would be nice but only 3 bands exist per unit_type; mix units
  const specs: [number, string, ProductCandidate['unitType']][] = [
    [100, 'g', 'mass'], [500, 'g', 'mass'], [2000, 'g', 'mass'], // 3 mass bands
    [250, 'ml', 'volume'], [1000, 'ml', 'volume'], [2000, 'ml', 'volume'], // 3 volume bands
  ];
  specs.forEach(([q, u, ut], i) => {
    cands.push(candidate({ productId: i, chainSlug: `c${i}`, name: `Iets ${q}`, parsedQuantity: q, parsedUnit: u, unitType: ut, price: i + 1 }));
  });
  const kinds = standardizeVariants(cands);
  assert.equal(kinds.length, 4);
});

test('single-chain noise kinds are dropped when broad (multi-chain) kinds exist', () => {
  const cands: ProductCandidate[] = [
    // small block at 3 chains
    ...['ah', 'jumbo', 'lidl'].map((c, i) =>
      candidate({ productId: i, chainSlug: c, name: 'Goudse kaas 200 g', parsedQuantity: 200, parsedUnit: 'g', unitType: 'mass', price: 2 + i })),
    // big block at 2 chains
    ...['ah', 'jumbo'].map((c, i) =>
      candidate({ productId: 10 + i, chainSlug: c, name: 'Goudse kaas 1 kg', parsedQuantity: 1, parsedUnit: 'kg', unitType: 'mass', price: 6 + i })),
    // lone oddball at a single chain, different band
    candidate({ productId: 20, chainSlug: 'spar', name: 'Kaas rondje', parsedQuantity: 1, parsedUnit: 'stuk', unitType: 'count', price: 0.95 }),
  ];
  const kinds = standardizeVariants(cands);
  assert.equal(kinds.length, 2); // two broad size kinds; the single-chain count kind is dropped
  assert.ok(kinds.every((k) => k.chainCount >= 2));
});

test('ties on chain breadth are broken by cheapest price', () => {
  const kinds = standardizeVariants([
    candidate({ productId: 1, chainSlug: 'ah', name: 'Melk 1 l', parsedQuantity: 1, parsedUnit: 'l', unitType: 'volume', price: 1.2 }),
    candidate({ productId: 2, chainSlug: 'ah', name: 'Sap 250 ml', parsedQuantity: 250, parsedUnit: 'ml', unitType: 'volume', price: 0.8 }),
  ]);
  // both kinds have chainCount 1 -> cheaper (sap 0.80) first
  assert.equal(kinds.length, 2);
  assert.equal(kinds[0].fromPrice, 0.8);
});
