// Tests for the date helpers behind list cards and default list names. These assert
// relative to the current date (no Date mocking) so they stay deterministic: "today"
// is always today, and a two-year-old date is always a different year.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatListDate, formatNewListName } from '../src/lib/format-date.ts';

test('same calendar day renders the localized "today" word', () => {
  const today = new Date().toISOString();
  assert.equal(formatListDate(today, 'nl'), 'vandaag');
  assert.equal(formatListDate(today, 'en'), 'today');
});

test('a date in a previous year includes the year', () => {
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, 5, 15).toISOString();
  const label = formatListDate(twoYearsAgo, 'nl');
  assert.match(label, new RegExp(String(now.getFullYear() - 2)));
  assert.notEqual(label, 'vandaag');
});

test('a date earlier this year omits the (current) year', () => {
  const now = new Date();
  // A different month in the same year -> definitely not today, definitely this year.
  const otherMonth = (now.getMonth() + 6) % 12;
  const thisYear = new Date(now.getFullYear(), otherMonth, 15).toISOString();
  const label = formatListDate(thisYear, 'en');
  assert.ok(!label.includes(String(now.getFullYear())), `"${label}" should not contain the current year`);
  assert.notEqual(label, 'today');
});

test('new-list name is a capitalized weekday + day + month label, no prefix', () => {
  const monday = new Date(2026, 6, 6); // Monday 6 July 2026
  assert.equal(formatNewListName('nl', monday), 'Maandag 6 Juli');
  assert.equal(formatNewListName('en', monday), 'Monday July 6');
});
