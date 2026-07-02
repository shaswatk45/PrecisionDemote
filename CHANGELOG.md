# Changelog

## v2.0.0 — Audit & overhaul

A full audit (see [`AUDIT.md`](AUDIT.md)) followed by verified changes across the
Clang tool, backend, frontend, tests, and docs.

### Clang tool (`clang-tool/src/main.cpp`)
- **Added** a `blockReason` field to every node — the analyzer is now the single
  source of truth for *why* a variable was kept (`type` / `accumulator` /
  `division` / `depth` / `fan-in`).
- **Added** tracking of `double` locals, surfaced as type-blocked nodes so they
  appear in the report (never demoted).
- **Added** self-describing JSON metadata: `toolVersion`, `engine`, and the
  `thresholds` (`maxDepth`, `maxFanIn`) a report was produced with.
- **Fixed** the `safeTodemote` → `safeToDemote` JSON key typo.

### Tests
- **Fixed** TC5 (`tests/tc_fanin.cpp`): balanced the initializers so the fan-in
  rule is tested in isolation instead of being pre-empted by the depth rule.
- Result: **60/60** checks pass (up from a real baseline of 56/57), and TC7's
  `double_only` variables are now genuinely validated instead of skipped.

### Backend (`backend/`)
- **Security:** replaced string-interpolated `execSync` with `execFileSync`
  argument arrays — eliminates shell command injection via file paths.
- **Security:** added dependency-free security headers, an in-memory rate
  limiter, a configurable CORS allow-list, and UUID-only upload filenames.
- **Refactor:** extracted the pure analysis engine into `analyzer.js`
  (with `blockReason` + `double` parity with the Clang tool).
- **Added** endpoints: `GET /api/version` and `POST /api/download` (streams the
  rewritten source as a file). `/api/health` now reports the active thresholds.
- **Added** a `node --test` unit suite (`backend/test/analyzer.test.js`, 9 tests).
- **Added** configurable thresholds via `MAX_DEPTH` / `MAX_FAN_IN` env vars.

### Frontend (`frontend/`)
- **Unified** the theme: `safe` = teal, `unsafe` = rose (matching the charts and
  diff), brand `accent` = indigo (distinct from the semantic red).
- **Added** Copy + Download of the rewritten source in the diff view.
- **Added** a React error boundary, a footer, `Ctrl/⌘+Enter` to analyze, and
  ARIA labels.
- **Refactored** the "why kept" logic to consume the analyzer's `blockReason`
  (shared `src/lib/blockReason.js`) instead of re-deriving it.
- Thresholds shown in the UI are now read from the backend, not hard-coded.

## v1.0.0
- Initial release: Clang LibTooling FP32→FP16 demotion tool, Express backend
  with WSL bridge + JS fallback, and a React/Vite dashboard.
