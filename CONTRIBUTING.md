# Contributing

Thanks for working on Basket. A few conventions keep the history reviewable and `main`
releasable.

## No direct commits to `main`

`main` is protected. Every change lands through a pull request that CI has approved —
no pushing straight to `main`, no force-pushes.

## Branch naming

Branch off the current integration branch (or `main` once it's the baseline) using a
type prefix:

- `feat/…` — a new user-facing capability
- `fix/…` — a bug fix
- `perf/…` — a performance improvement
- `refactor/…` — internal change, no behavior change
- `chore/…` — tooling, deps, CI, housekeeping
- `security/…` — a security fix or hardening

Example: `fix/list-hub-empty-state`.

## Commits

One concern per commit, with a clear message. Never mix a refactor with a behavior
change. This repo does **not** add a `Co-Authored-By` trailer (see `CLAUDE.md`).

## Every PR updates the changelog

Add an entry under `[Unreleased]` in `CHANGELOG.md` (Keep a Changelog format: Added /
Changed / Fixed / Removed / Security). The `Changelog` CI check enforces this; a PR that
genuinely needs no entry (e.g. a pure CI tweak) can carry the `no-changelog` label.

Fill in the PR template: what changed and why, the change category, and honest test
evidence.

## CI must be green to merge

Every PR runs typecheck, lint, and the test suite (`.github/workflows/ci.yml`). Run them
locally first:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # node --test (pure-logic unit tests)
```

There is no automated UI/integration test harness — RN screens are verified by driving
the app in a simulator/device. Say in the PR what you actually exercised, and be explicit
about anything you couldn't verify.
