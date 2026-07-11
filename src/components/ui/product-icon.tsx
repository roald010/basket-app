import Svg, { Circle, Path } from 'react-native-svg';

export type ProductCategory = 'produce' | 'dairy' | 'meatFish' | 'bakery' | 'pantry' | 'frozen' | 'drinks' | 'household' | 'other';

// Keyword -> category, matched on whole words/phrases only (see matchProductCategory)
// so e.g. "ham" never fires inside "Shampoo" -- a plain substring match did exactly that.
// Best-effort (NL + EN), same spirit as the emoji list this replaces: staple_templates
// has no real category data, so this is a lightweight stand-in, not catalog matching.
const CATEGORY_KEYWORDS: [string, ProductCategory][] = [
  ['aardappel', 'produce'],
  ['potato', 'produce'],
  ['ui', 'produce'],
  ['onion', 'produce'],
  ['knoflook', 'produce'],
  ['garlic', 'produce'],
  ['tomaat', 'produce'],
  ['tomato', 'produce'],
  ['courgette', 'produce'],
  ['zucchini', 'produce'],
  ['komkommer', 'produce'],
  ['cucumber', 'produce'],
  ['paprika', 'produce'],
  ['pepper bell', 'produce'],
  ['appel', 'produce'],
  ['apple', 'produce'],
  ['banaan', 'produce'],
  ['banana', 'produce'],
  ['sinaasappel', 'produce'],
  ['orange', 'produce'],
  ['citroen', 'produce'],
  ['lemon', 'produce'],
  ['groente', 'produce'],
  ['vegetable', 'produce'],
  ['fruit', 'produce'],
  ['karnemelk', 'dairy'],
  ['melk', 'dairy'],
  ['milk', 'dairy'],
  ['boter', 'dairy'],
  ['butter', 'dairy'],
  ['kaas', 'dairy'],
  ['cheese', 'dairy'],
  ['pecorino', 'dairy'],
  ['parmezaan', 'dairy'],
  ['parmesan', 'dairy'],
  ['mozzarella', 'dairy'],
  ['gouda', 'dairy'],
  ['cheddar', 'dairy'],
  ['feta', 'dairy'],
  ['eieren', 'dairy'],
  ['ei', 'dairy'],
  ['egg', 'dairy'],
  ['yoghurt', 'dairy'],
  ['yogurt', 'dairy'],
  ['room', 'dairy'],
  ['ham', 'meatFish'],
  ['spek', 'meatFish'],
  ['bacon', 'meatFish'],
  ['kip', 'meatFish'],
  ['chicken', 'meatFish'],
  ['vis', 'meatFish'],
  ['fish', 'meatFish'],
  ['zalm', 'meatFish'],
  ['salmon', 'meatFish'],
  ['vlees', 'meatFish'],
  ['meat', 'meatFish'],
  ['gehakt', 'meatFish'],
  ['brood', 'bakery'],
  ['bread', 'bakery'],
  ['broodje', 'bakery'],
  ['croissant', 'bakery'],
  ['diepvries', 'frozen'],
  ['frozen', 'frozen'],
  ['ijs', 'frozen'],
  ['ice cream', 'frozen'],
  ['bier', 'drinks'],
  ['beer', 'drinks'],
  ['wijn', 'drinks'],
  ['wine', 'drinks'],
  ['sap', 'drinks'],
  ['juice', 'drinks'],
  ['water', 'drinks'],
  ['cola', 'drinks'],
  ['fris', 'drinks'],
  ['soda', 'drinks'],
  ['koffie', 'pantry'],
  ['coffee', 'pantry'],
  ['thee', 'pantry'],
  ['tea', 'pantry'],
  ['suiker', 'pantry'],
  ['sugar', 'pantry'],
  ['zout', 'pantry'],
  ['salt', 'pantry'],
  ['peper', 'pantry'],
  ['pepper', 'pantry'],
  ['olie', 'pantry'],
  ['oil', 'pantry'],
  ['azijn', 'pantry'],
  ['vinegar', 'pantry'],
  ['pasta', 'pantry'],
  ['spaghetti', 'pantry'],
  ['rijst', 'pantry'],
  ['rice', 'pantry'],
  ['chocolade', 'pantry'],
  ['chocolate', 'pantry'],
  ['koek', 'pantry'],
  ['cookie', 'pantry'],
  ['chips', 'pantry'],
  ['noten', 'pantry'],
  ['nuts', 'pantry'],
  ['honing', 'pantry'],
  ['honey', 'pantry'],
  ['jam', 'pantry'],
  ['pindakaas', 'pantry'],
  ['peanut butter', 'pantry'],
  ['muesli', 'pantry'],
  ['cornflakes', 'pantry'],
  ['ontbijtgranen', 'pantry'],
  ['cereal', 'pantry'],
  ['wc-papier', 'household'],
  ['toiletpapier', 'household'],
  ['toilet paper', 'household'],
  ['afwasmiddel', 'household'],
  ['wasmiddel', 'household'],
  ['detergent', 'household'],
  ['tandpasta', 'household'],
  ['toothpaste', 'household'],
  ['shampoo', 'household'],
  ['zeep', 'household'],
  ['soap', 'household'],
];

const keywordPatterns = CATEGORY_KEYWORDS.map(
  ([keyword, category]) => [new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), category] as const
);

export function matchProductCategory(name: string): ProductCategory {
  for (const [pattern, category] of keywordPatterns) {
    if (pattern.test(name)) return category;
  }
  return 'other';
}

type ProductIconProps = {
  category: ProductCategory;
  color: string;
  size?: number;
};

/** A small, fixed set of hand-drawn category icons -- not traced from the design doc
 * (it doesn't cover this), but matching NavIcon's style: 24x24 viewBox, stroke-only
 * lines, no per-category color coding (the brand reserves color for meaning, e.g.
 * green = cheapest -- see theme.ts), so the tile background stays neutral. */
export function ProductIcon({ category, color, size = 22 }: ProductIconProps) {
  switch (category) {
    case 'produce':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 19C5 10 12 5 19 5c0 9-6 15-14 14Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
          <Path d="M6 18 16 8" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
    case 'dairy':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M8 4h8l1.5 3.5V20a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V7.5L8 4Z"
            stroke={color}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
          <Path d="M6.5 7.5h11M9.5 4 12 2l2.5 2" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'meatFish':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 12c3-3.5 7-5 11-5 3 1.5 5 3.5 7 5-2 1.5-4 3.5-7 5-4 0-8-1.5-11-5Z"
            stroke={color}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
          <Circle cx={15} cy={11.2} r={0.7} fill={color} />
        </Svg>
      );
    case 'bakery':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 12c0-3 2-5 5-5h6c3 0 5 2 5 5v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z"
            stroke={color}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
          <Path d="M8 8.5v4M12 7.5v5M16 8.5v4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    case 'pantry':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M9 3h6v3H9V3Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
          <Path d="M7 6h10l1 3v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9l1-3Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
        </Svg>
      );
    case 'frozen':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'drinks':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M7 8h10l-1.2 10.5a2 2 0 0 1-2 1.8h-3.6a2 2 0 0 1-2-1.8L7 8Z"
            stroke={color}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
          <Path d="M9 8 8 4M15 8l1-4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    case 'household':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M10 3h3v2.5l1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 8.5 19V7L10 5.5V3Z"
            stroke={color}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
          <Path d="M14.5 6h3M17 6v2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    case 'other':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 8h16l-1.3 9a2 2 0 0 1-2 1.7H7.3a2 2 0 0 1-2-1.7L4 8Z"
            stroke={color}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
          <Path d="M8.5 8 12 3.5 15.5 8" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
  }
}
