# Maintenance pass — `chore/maintenance-baseline`

Autonomous maintenance pass on the Basket app (Expo / React Native + Supabase,
TypeScript strict), plus setup of a PR + changelog workflow so future changes are
gated. Branch: `chore/maintenance-baseline`, based on `feat/basket-app-mvp`.

## Why the branch is based on `feat/basket-app-mvp`, not `main`

The entire application lives on `feat/basket-app-mvp`, which is **20 commits ahead of
`origin/main`** (and `main` has nothing the feature branch lacks). Branching maintenance
off `main` would have produced an empty app with nothing to maintain. So this branch is
based on `feat/basket-app-mvp`, and the PR should target `feat/basket-app-mvp` — that
keeps the PR diff to just the maintenance commits rather than re-showing all 20 MVP
commits.

## Baseline

Established a green baseline before any change:

| Gate | Command | Baseline |
| --- | --- | --- |
| Type-check | `npx tsc --noEmit` | ✅ clean |
| Lint | `npx expo lint` | ✅ clean |
| Tests | — | none existed |

There was **no test suite** and no test framework installed. The project's quality gate
was type-check + lint only.

## Summary by category

### Dead code — removed

All were leftover Expo-template scaffold, proven unreferenced repo-wide (grep across
`src/`, `app.json`, `README`, including the whole repo, before deleting):

- **Components:** `ExternalLink`, `HintRow`, `Collapsible`, `WebBadge` (4 files), and the
  unused `AnimatedIcon` export in `animated-icon.tsx` / `.web.tsx` (only its sibling
  `AnimatedSplashOverlay` is actually imported, by `src/app/_layout.tsx`).
- **Assets** freed by the above: `expo-badge.png`, `expo-badge-white.png`, `logo-glow.png`,
  `react-logo.png/@2x/@3x`, `tutorial-web.png`, `tabIcons/` (6 files), and
  `animated-icon.module.css`.
- Net: 30 files changed, **367 deletions**.

No TODO/FIXME debris, no commented-out code blocks, and no permanently-on/off feature
flags were found — the codebase was already clean of those.

### Performance — reviewed, no change

No concrete bottleneck found; nothing was changed rather than manufacture a speculative
refactor. Findings:

- **No N+1 queries.** The Supabase data layer uses PostgREST embedded selects
  (`lists(... recipes(... list_items(...)))`), i.e. one round-trip per screen.
- **React Query is well-tuned** (`src/lib/query-client.ts`): `staleTime` 30s, one retry,
  `refetchOnWindowFocus: false` for native.
- **Rendering is already memoized.** The heaviest screen (`list/[id].tsx`) wraps every
  derivation — including the exponential-ish `bestCombos` optimizer — in `useMemo` with
  correct dependency arrays. Screens use `ScrollView` + `.map`, which is appropriate for
  a grocery app's small lists (a handful of recipes / a dozen items), not a bottleneck.

### Security — reviewed, strong posture, no code change required

Reviewed the full backend and client secret handling. No vulnerability warranting a code
change was found:

- **Secrets:** `.env`, `.env*.local`, `supabase/.env.local`, and `supabase/.temp/` are
  gitignored and **not tracked**. No secrets, credentials, or `.DS_Store` in the repo.
- **RLS:** every user table enforces ownership via `auth.uid()`; catalog tables are
  read-only to clients, writes reserved for the service role.
- **SQL:** `match_list_items()` is `SECURITY INVOKER` with a pinned
  `search_path = public, extensions` and **no dynamic SQL** (no `EXECUTE` string
  concatenation) — not injectable.
- **Edge Functions:** `ingest-checkjebon` gates on a `service_role` JWT claim on top of
  platform `verify_jwt`; both functions use parameterized `supabase-js` calls and return
  generic errors to the client (details only to `console.error`).

Two low-severity Edge-Function hardening notes are left **open** (see table below) — they
can't be verified in this environment (Deno runtime + external Anthropic API) and applying
them would require a redeploy this session can't perform or confirm, which would leave the
committed source diverging from the deployed function. They are reported, not silently
applied.

### Code health

- Added a real (zero-dependency) **test suite** — see below.
- Added `typecheck` npm script; wired `test` into CI.
- One file exceeds the repo's 500-line guideline (`src/app/list/[id].tsx`, 675 lines).
  Left as-is deliberately — see "Deliberately left alone".

## Security findings

| # | Finding | Severity | Status | Note |
| --- | --- | --- | --- | --- |
| 1 | `parse-recipe`: `servingsTarget / parsed.servingsDetected` divides by zero if the model returns `servingsDetected: 0`, yielding `Infinity` quantities written to the DB. | Low | **Open (not fixed)** | Fix is a one-line guard (`parsed.servingsDetected > 0 ? … : 1`). Not applied: Deno function, not runnable/testable here, and a fix requires a redeploy I can't verify — would diverge committed source from deployed. |
| 2 | `parse-recipe`: request `text` length is unbounded — a caller could submit a very large body (LLM cost / DoS surface). Output is bounded (`max_tokens`), input is not. | Low | **Open (not fixed)** | Fix is a length cap returning 413. Same deferral reason as #1. |
| — | Secrets committed, injection, RLS gaps, permissive CORS, sensitive data in logs | — | **None found** | See Security section above. |

No security **code fix** was made, so the "each security fix needs a test that fails
against old behavior" requirement is not applicable to any committed change. The two open
items are documented for a follow-up that can redeploy and verify against Deno.

## Every change → test covering it

This pass **removed dead code, added tests, and added workflow config** — it did **not
modify the behavior of any live app function**. So the table below maps each change to how
it is verified.

### Behavior added (pure logic) — covered by new tests

| Function (module) | Test(s) | Result |
| --- | --- | --- |
| `bestCombos` (`features/matching/optimize.ts`) | `optimize.test.ts`: empty input, no-match items, single-store coverage+tie-break, 2-store full coverage, coverage-beats-cheaper, maxStores cap | ✅ pass |
| `assignItems` (`features/matching/optimize.ts`) | `optimize.test.ts`: cheapest-in-combo routing, gap omission, assign-total == combo-total | ✅ pass |
| `embeddedOne` (`lib/postgrest.ts`) | `postgrest.test.ts`: object shape, 1-element array, empty array→null, null/undefined→null, safe `.price` read | ✅ pass |
| `formatListDate` (`lib/format-date.ts`) | `format-date.test.ts`: today→word, previous-year→includes year, this-year→omits year | ✅ pass |
| `formatNewListName` (`lib/format-date.ts`) | `format-date.test.ts`: localized prefix | ✅ pass |

**18 tests, all passing.** These are regression/characterization tests: no pre-existing
bug was found in the tested modules (the historical `embeddedOne` bug was already fixed;
test #14–18 lock that fix in).

### Behavior removed (dead code) — verified by non-reference

| Removed | How verified |
| --- | --- |
| `ExternalLink`, `HintRow`, `Collapsible`, `WebBadge`, `AnimatedIcon` + assets/CSS | Grepped unreferenced across the whole repo before deletion; `tsc --noEmit` + `expo lint` stay clean after each commit (a dangling import would fail type-check). There is no behavior to unit-test for deleted-and-unreferenced code. |

### Config / workflow changes

| Change | How verified |
| --- | --- |
| `ci.yml`, `changelog.yml` | Validated as parseable YAML (`js-yaml`); logic reviewed. Not executed here (they run on GitHub). |
| `package.json` scripts, `tsconfig.json` exclude | Exercised directly: `npm run typecheck`, `npm test`, `npm run lint` all pass locally. |

## Test / lint / typecheck / build output (actual)

```
$ npm run typecheck
> tsc --noEmit
[exit 0]   (no output = clean)

$ npm run lint
> expo lint
env: load .env.local
env: export EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_SUPABASE_URL
[exit 0]

$ npm test
> node --test --experimental-strip-types "tests/**/*.test.ts"
ok 1 - same calendar day renders the localized "today" word
ok 2 - a date in a previous year includes the year
ok 3 - a date earlier this year omits the (current) year
ok 4 - new-list name is prefixed and localized
ok 5 - empty input yields no combos
ok 6 - items that matched no chain yield no combos
ok 7 - single-store pick: most items covered wins, cheapest total breaks ties
ok 8 - adding a second store can cover the whole basket for a lower combined total
ok 9 - coverage beats a cheaper-but-incomplete combo (honest-gap principle)
ok 10 - maxStores is capped at the number of distinct chains available
ok 11 - assignItems routes each item to its cheapest in-combo chain and skips gaps
ok 12 - assignItems omits items no chosen chain carries
ok 13 - assignItems total equals the combo total for the same chains
ok 14 - a bare object (the real many-to-one shape) is returned as-is
ok 15 - a one-element array is collapsed to its element
ok 16 - an empty array becomes null, not undefined
ok 17 - null and undefined both become null
ok 18 - reading .price off the result is safe for the object shape
# tests 18
# pass 18
# fail 0
[exit 0]
```

**Build:** there is **no build step** in this project's gate. It has no `build` script and
no `eas.json`. A native build requires Xcode / EAS (not available in this environment);
`expo export` for web has a known, **pre-existing** SSR crash (`window is not defined` via
Supabase's AsyncStorage adapter under `web.output: "static"`) that is unrelated to this
pass. I did not run a build and am not claiming one passes. The CI workflow gate is
typecheck + lint + test.

## Testability caveats (stated explicitly)

- **Edge Functions** (`supabase/functions/*`) are Deno, excluded from the app's `tsc`/lint,
  and call external services (Anthropic, checkjebon). They can't be run or unit-tested in
  this Node environment — hence security findings #1/#2 are reported, not fixed.
- **RN screens/components** have no unit tests: that would require adding
  jest + jest-expo + testing-library (multiple new dependencies), which the task forbids.
  They are verified in this project by driving a simulator, which this session cannot do.
- The added tests therefore cover exactly the pure, framework-free logic — the subset that
  can be honestly and reproducibly tested with zero new dependencies.

## Deliberately left alone

| Item | Why |
| --- | --- |
| `src/app/list/[id].tsx` is 675 lines (> the 500-line guideline) | Splitting the app's most complex screen is a refactor I can't visually verify here (no simulator), and the task says prefer a small correct change over a clever one and never mix refactor with behavior change. Flagged for a dedicated, simulator-verified refactor PR. |
| `formatNewListName` still emits `"Lijst:"` / `"List:"` while the app rebranded lists to "Basket/Mandje" in user-facing copy | User-facing copy is a product decision; changing it is out of scope for a maintenance pass. Flagged. |
| Edge-Function hardening (#1, #2) | Requires a redeploy this session can't perform/verify; would diverge committed source from the deployed function. |
| `TabButton` / `CustomTabList` exported from `app-tabs.web.tsx` | Not dead — used internally in the same file. Only over-exported; not worth churning. |
| The two Edge Functions' pure helpers (`parseSize`, etc.) | Genuinely testable, but extracting them from the deployed Deno function is a refactor of live infra I can't verify. |

## Things I wasn't fully confident about

- **PR base branch.** I based this on `feat/basket-app-mvp` and recommend targeting the PR
  there (reasoning above). If you'd rather the PR target `main`, the diff will also include
  the 20 MVP commits — that's a repo-structure decision for you.
- **Branch protection** could not be applied by me (no `gh`/token — see below); the exact
  commands are provided for you to run.
- **CI on Node 22.** The test job needs Node 22 for TypeScript type-stripping; I bumped
  `setup-node` accordingly. typecheck + lint are unaffected by the bump.

## Actions you need to take (I can't — no `gh` CLI / token in this environment)

`gh` is not installed and there's no `GH_TOKEN`, so I can't open the PR or set branch
protection. Run these yourself.

### 1. Open the PR

```
# from basket-app/, after the branch is pushed:
gh pr create \
  --base feat/basket-app-mvp \
  --head chore/maintenance-baseline \
  --title "chore: maintenance baseline (dead code, tests, PR/changelog workflow)" \
  --body-file MAINTENANCE-REPORT.md
```

Or open it in the browser:
`https://github.com/roald010/basket-app/compare/feat/basket-app-mvp...chore/maintenance-baseline`

### 2. Set branch protection on `main`

Requires admin on the repo. Replace nothing — this is ready to paste:

```
gh api -X PUT repos/roald010/basket-app/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[checks][][context]=typecheck + lint + test' \
  -f 'required_status_checks[checks][][context]=CHANGELOG.md updated' \
  -f 'enforce_admins=true' \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -f 'restrictions=' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```

This: requires a PR before merging, requires the CI job (`typecheck + lint + test`) and the
changelog check (`CHANGELOG.md updated`) to pass, requires the branch to be up to date
(`strict=true`), and blocks force-pushes and deletions. The check **contexts** must match
the job `name:` values exactly — they'll appear in the checks list after the workflows run
once on a PR, so if the API rejects an unknown context, open one PR first, then re-run this.

If you don't have `gh`: install it (`brew install gh && gh auth login`), or set the same
options in **Settings → Branches → Add branch protection rule** for `main`
(require PR, require status checks `typecheck + lint + test` and `CHANGELOG.md updated`,
require branches up to date, block force pushes).
