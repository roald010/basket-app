# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Basket is an Expo (React Native) app: a Dutch grocery-list app where a named **List**
holds multiple **recipes** plus recurring **staples**, prices the whole thing across
several Dutch supermarket chains, and helps decide whether shopping at 1, 2, or 3
stores is worth the extra effort. Core model: **a list is not a recipe** — capture
*adds* a recipe to a list; the **List Hub** is the home base every flow returns to.

## Commands

```bash
npm install            # install dependencies
npx expo start          # start the dev server (or: npm start)
npm run ios             # start + open iOS simulator
npm run android         # start + open Android emulator
npm run web              # start + open in browser
npm run lint             # expo lint (ESLint)
npm run reset-project     # moves the ENTIRE /src (and /scripts) directory to /example and starts a blank src/app — do not run, it would delete all product code built so far
```

No test suite exists in this repo yet.

Supabase backend (see `supabase/`), CLI via `npx supabase <cmd>` (no global install):
```bash
npx supabase init                              # already done
npx supabase link --project-ref <ref>          # link to a hosted project
npx supabase db push                           # apply supabase/migrations/*.sql + seed.sql
npx supabase functions serve <name>             # local Edge Function iteration (needs Docker)
```
`supabase start` (local Postgres for offline dev) requires Docker, which is not assumed
to be installed — check before relying on it.

## Architecture

**Routing lives at `src/app/`, not the repo-root `app/`.** Expo Router's root has been
relocated (see `tsconfig.json` path aliases: `@/*` → `./src/*`, `@/assets/*` → `./assets/*`).
Always import via `@/...`, never relative-path across top-level folders.

**Design tokens are centralized in `src/constants/theme.ts`** — the single source of
truth for color, type, and spacing:
- `Colors.light` / `Colors.dark` — semantic tokens (text, background, backgroundElement,
  chipNeutralBg/chipCheapestBg, honestGapBg/Border, headerGreen, etc.), consumed via the
  `useTheme()` hook (`src/hooks/use-theme.ts`), never imported as raw hex in components.
- `BrandColors` — fixed-hue brand constants (green/clementine/amber) that do **not**
  flip between light/dark, unlike `Colors`. Green specifically means "cheapest/selected
  store" and must never be used to imply a real supermarket's brand color — store
  identity elsewhere is neutral grey monogram chips (`components/ui/store-chip.tsx`).
- `Fonts` — system fonts (`sans`/`serif`/`rounded`/`mono`, used for the `code` text type)
  plus `Fonts.display`/`Fonts.body` (Bricolage Grotesque / Hanken Grotesk, loaded via
  `useFonts()` in `src/app/_layout.tsx`, which blocks the splash-hide until ready — see
  that file before changing font loading or splash behavior).
- `Spacing` is the only spacing scale — don't hardcode pixel gaps.
- No NativeWind/Tailwind/Tamagui — styling is plain `StyleSheet.create` plus these tokens.

**`ThemedText` / `ThemedView`** (`src/components/themed-text.tsx`, `themed-view.tsx`)
are the base primitives nearly everything else wraps. `ThemedText` takes a `type` (not a
raw style) and a `tabularNums` modifier for prices/counts — money is always rendered
green + tabular-nums via `components/ui/price-text.tsx`, not ad hoc.

**`src/components/ui/`** holds the shared design-system components (button, store-chip,
segmented-control, stepper, toggle, entity-card, honest-gap-card, total-banner,
price-text). Prefer extending/composing these over building one-off equivalents per
screen — several screens intentionally share the same card/banner shape.

**Backend is Supabase** (`supabase/migrations/`, `supabase/seed.sql`): Postgres + Auth +
Edge Functions. No login screen — every device gets an anonymous Supabase session
(`src/lib/supabase.ts`, `ensureSession()`), and RLS policies key off `auth.uid()`
everywhere. Data model highlights:
- `lists` → `recipes` → `list_items` (`list_items` unifies recipe ingredients *and*
  staple rows into one stream that Compare/Shopping both iterate over).
- `products` is the ingested per-chain price catalog (currently sourced from the
  `checkjebon` public dataset; designed so a future in-house scraper can write into the
  same `(chain_slug, source_id, name, raw_size, price)` shape without a schema change).
- `list_item_matches` records one row **per item × chain**, not a single match column
  on `list_items` — Compare needs a per-chain price to rank 1/2/3-store combinations,
  and an ingredient can match at one chain but not another (the amber "no match" state).
- Server-only secrets (the LLM recipe-parsing call) belong in Edge Functions, never in
  client code — the anon key in `.env.local` is meant to be public; access control is
  RLS, not secrecy of that key.

**Data fetching**: TanStack Query (`@tanstack/react-query`) + `supabase-js` is the
server-state layer — no Redux/Zustand. Ephemeral UI-only state (in-progress form
values, which option is highlighted before confirming) stays in local component state.
