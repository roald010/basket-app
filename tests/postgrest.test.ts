// Regression guard for embeddedOne(). supabase-js (without a generated Database type)
// mistypes a many-to-one PostgREST embed as an array, but PostgREST returns a bare
// object; indexing [0] on it yields undefined at runtime. This bug silently broke all
// pricing once (see git history / project memory). These tests lock the fix in.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { embeddedOne } from '../src/lib/postgrest.ts';

test('a bare object (the real many-to-one shape) is returned as-is', () => {
  const product = { id: '1', price: 2.5 };
  assert.deepEqual(embeddedOne(product), product);
});

test('a one-element array is collapsed to its element', () => {
  assert.deepEqual(embeddedOne([{ price: 2.5 }]), { price: 2.5 });
});

test('an empty array becomes null, not undefined', () => {
  assert.equal(embeddedOne([]), null);
});

test('null and undefined both become null', () => {
  assert.equal(embeddedOne(null), null);
  assert.equal(embeddedOne(undefined), null);
});

test('reading .price off the result is safe for the object shape', () => {
  // The exact runtime failure the helper prevents: `products[0].price` on an object
  // is undefined; embeddedOne(products)?.price is the real value.
  const embed = { price: 3.99 } as { price: number } | { price: number }[] | null;
  assert.equal(embeddedOne(embed)?.price, 3.99);
});
