// Store-combination optimizer (M5). Given each list item's matched price at each chain,
// finds the cheapest set of N chains for N = 1..maxStores. This is a pure function over
// the data `match_list_items()` produced -- no DB access -- so the "is a 2nd/3rd store
// worth it" comparison is computed live rather than persisted (store_selections is only
// written once the user commits a choice, which belongs to the later Shopping slice).

export type OptimizerChainPrice = { chainSlug: string; price: number };

/** One list item and the price it matched at, per chain (only chains where it matched). */
export type OptimizerItem = { listItemId: string; prices: OptimizerChainPrice[] };

export type StoreCombo = {
  storeCount: number;
  /** The chosen chain slugs, cheapest-total combo for this store count. */
  chains: string[];
  /** Sum of the cheapest in-combo price for each item this combo covers. */
  total: number;
  /** Items at least one chosen chain carries. */
  coveredCount: number;
  /** Items no chosen chain carries -- the honest "zelf pakken" gap. */
  gapCount: number;
};

function combinations<T>(items: T[], k: number): T[][] {
  if (k <= 0 || k > items.length) return k === 0 ? [[]] : [];
  const [first, ...rest] = items;
  const withFirst = combinations(rest, k - 1).map((combo) => [first, ...combo]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/** Cost + coverage of buying each item at the cheapest chain within `combo` that carries it. */
function evaluate(items: OptimizerItem[], combo: Set<string>): { total: number; coveredCount: number } {
  let total = 0;
  let coveredCount = 0;
  for (const item of items) {
    let best: number | null = null;
    for (const { chainSlug, price } of item.prices) {
      if (combo.has(chainSlug) && (best === null || price < best)) best = price;
    }
    if (best !== null) {
      total += best;
      coveredCount += 1;
    }
  }
  return { total, coveredCount };
}

/** Best combo of exactly `count` chains: most items covered wins, cheapest total breaks ties. */
function bestComboForCount(items: OptimizerItem[], chains: string[], count: number): StoreCombo | null {
  let best: StoreCombo | null = null;
  for (const comboChains of combinations(chains, count)) {
    const { total, coveredCount } = evaluate(items, new Set(comboChains));
    const candidate: StoreCombo = {
      storeCount: count,
      chains: comboChains,
      total,
      coveredCount,
      gapCount: items.length - coveredCount,
    };
    if (
      best === null ||
      candidate.coveredCount > best.coveredCount ||
      (candidate.coveredCount === best.coveredCount && candidate.total < best.total)
    ) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Best combo for each store count 1..min(maxStores, availableChains). Chains that carry
 * no items at all are ignored (they can never improve a combo). Returns [] when there is
 * nothing to price yet.
 */
export function bestCombos(items: OptimizerItem[], maxStores = 3): StoreCombo[] {
  if (items.length === 0) return [];
  const chains = [...new Set(items.flatMap((item) => item.prices.map((p) => p.chainSlug)))];
  if (chains.length === 0) return [];

  const combos: StoreCombo[] = [];
  const limit = Math.min(maxStores, chains.length);
  for (let count = 1; count <= limit; count += 1) {
    const combo = bestComboForCount(items, chains, count);
    if (combo) combos.push(combo);
  }
  return combos;
}
