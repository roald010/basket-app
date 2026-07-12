# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Unit tests for the pure business logic (store-combination optimizer, PostgREST
  `embeddedOne` embed-normalizer, date helpers), run via Node's built-in test runner
  with TypeScript type-stripping — no test-framework dependency added. `npm test`.
- `typecheck` npm script (`tsc --noEmit`).
- `CHANGELOG.md` (this file), `CONTRIBUTING.md`, and a `Changelog` CI workflow that
  requires every PR to update the changelog (skippable with the `no-changelog` label).

### Changed

- CI now runs on every pull request (any base branch), executes the test suite, and
  runs on Node 22 (required for the test job's type-stripping).
- PR template now asks for a change category and a CHANGELOG-updated checkbox.
- Synced `CLAUDE.md` and `README.md` with the new `test`/`typecheck` scripts, the Node ≥ 22
  requirement, and the PR/changelog workflow (`CLAUDE.md` no longer says "no test suite").

### Removed

- Unused Expo-template scaffold: `ExternalLink`, `HintRow`, `Collapsible`, `WebBadge`,
  and the dead `AnimatedIcon` component, plus their orphaned image assets
  (`expo-badge*`, `react-logo*`, `tutorial-web`, `logo-glow`, `tabIcons/`) and the
  `animated-icon.module.css` only `AnimatedIcon` used.

### Security

- Reviewed the Supabase backend (RLS policies, `match_list_items` SECURITY INVOKER
  function, Edge Function auth) and client secret handling; no vulnerabilities found
  requiring a code change. See `MAINTENANCE-REPORT.md` for two low-severity
  Edge-Function hardening notes left open (deferred: unverifiable without the Deno
  runtime, and applying them requires a redeploy).
