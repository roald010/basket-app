// Tests for the store-combination optimizer -- the app's core "is a 2nd/3rd store
// worth it" logic. Pure and RN-free, so it runs under Node's built-in test runner
// with type-stripping (see package.json "test"). No test framework dependency.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bestCombos, assignItems, type OptimizerItem } from '../src/features/matching/optimize.ts';

// A: cheapest at jumbo; B: only jumbo carries it; C: cheapest at lidl.
const ITEMS: OptimizerItem[] = [
  { listItemId: 'a', prices: [{ chainSlug: 'ah', price: 2.0 }, { chainSlug: 'jumbo', price: 1.5 }] },
  { listItemId: 'b', prices: [{ chainSlug: 'jumbo', price: 1.0 }] },
  { listItemId: 'c', prices: [{ chainSlug: 'ah', price: 3.0 }, { chainSlug: 'lidl', price: 1.5 }] },
];

test('empty input yields no combos', () => {
  assert.deepEqual(bestCombos([]), []);
});

test('items that matched no chain yield no combos', () => {
  assert.deepEqual(bestCombos([{ listItemId: 'x', prices: [] }]), []);
});

test('single-store pick: most items covered wins, cheapest total breaks ties', () => {
  const [one] = bestCombos(ITEMS, 1);
  // ah covers {a,c}=5.00, jumbo covers {a,b}=2.50, lidl covers {c}=1.50.
  // ah and jumbo both cover 2 items -> cheaper (jumbo) wins.
  assert.equal(one.storeCount, 1);
  assert.deepEqual(one.chains, ['jumbo']);
  assert.equal(one.coveredCount, 2);
  assert.equal(one.gapCount, 1);
  assert.equal(one.total, 2.5);
});

test('adding a second store can cover the whole basket for a lower combined total', () => {
  const combos = bestCombos(ITEMS, 2);
  const two = combos.find((c) => c.storeCount === 2);
  assert.ok(two, 'a 2-store combo exists');
  // jumbo (a=1.5, b=1.0) + lidl (c=1.5) covers all 3 for 4.00, beating any other pair on coverage.
  assert.equal(two!.coveredCount, 3);
  assert.equal(two!.gapCount, 0);
  assert.equal(two!.total, 4.0);
  assert.deepEqual([...two!.chains].sort(), ['jumbo', 'lidl']);
});

test('coverage beats a cheaper-but-incomplete combo (honest-gap principle)', () => {
  // Two items: one only at ah, one only at jumbo. A single store always leaves a gap;
  // the 2-store combo must win on coverage even though its total is higher.
  const items: OptimizerItem[] = [
    { listItemId: 'p', prices: [{ chainSlug: 'ah', price: 5.0 }] },
    { listItemId: 'q', prices: [{ chainSlug: 'jumbo', price: 0.5 }] },
  ];
  const [one] = bestCombos(items, 1);
  assert.equal(one.coveredCount, 1);
  assert.equal(one.gapCount, 1);

  const two = bestCombos(items, 2).find((c) => c.storeCount === 2)!;
  assert.equal(two.coveredCount, 2);
  assert.equal(two.total, 5.5);
});

test('maxStores is capped at the number of distinct chains available', () => {
  // Only 3 chains exist across ITEMS, so asking for 5 stores yields at most 3 combos.
  const combos = bestCombos(ITEMS, 5);
  assert.equal(combos.length, 3);
  assert.deepEqual(combos.map((c) => c.storeCount), [1, 2, 3]);
});

test('assignItems routes each item to its cheapest in-combo chain and skips gaps', () => {
  const assignments = assignItems(ITEMS, ['jumbo', 'lidl']);
  const byItem = Object.fromEntries(assignments.map((a) => [a.listItemId, a]));
  assert.equal(byItem.a.chainSlug, 'jumbo'); // 1.5 < ah's 2.0 (ah not in combo anyway)
  assert.equal(byItem.b.chainSlug, 'jumbo');
  assert.equal(byItem.c.chainSlug, 'lidl');
  assert.equal(assignments.length, 3);
});

test('assignItems omits items no chosen chain carries', () => {
  // Only 'ah' chosen: item b (jumbo-only) has no assignment.
  const assignments = assignItems(ITEMS, ['ah']);
  assert.equal(assignments.length, 2);
  assert.ok(!assignments.some((a) => a.listItemId === 'b'));
});

test('assignItems total equals the combo total for the same chains', () => {
  const two = bestCombos(ITEMS, 2).find((c) => c.storeCount === 2)!;
  const assignments = assignItems(ITEMS, two.chains);
  const assignTotal = assignments.reduce((sum, a) => sum + a.price, 0);
  assert.equal(assignTotal, two.total);
});
