# Changelog

## v3.0.0 — Numerical model + analysis IDE

Turns the binary "demote / keep" tool into a **mixed-precision advisor** with a
quantified numerical model, and rebuilds the dashboard into a proper IDE.

### Engine (`clang-tool/src/main.cpp`)
- **Per-variable safety score (0–100)** — a graded confidence, distinct from the
  binary verdict, for ranking and heatmaps.
- **Static error-bound propagation** — estimates the relative rounding error a
  demotion introduces via first-order propagation over FP16/BF16 unit roundoff.
- **Range / overflow analysis (Rule 6)** — walks constant magnitudes (and
  inherits them across the dependency graph) to detect values beyond FP16's
  ±65504.
- **FP16 vs BF16 recommendation** — picks the optimal narrow type per variable:
  `__fp16` when precision- and range-safe, `__bf16` when only FP16 *range* fails
  (BF16 shares FP32's exponent range), `float` on a precision hazard.
- **Mixed-precision rewriting** — emits both `__fp16` and `__bf16` in one pass.
- New test case **TC8** (overflow → BF16); suite now **68/68**.

### Backend
- Full JS-fallback parity for the new numerical model.
- Richer metrics: avg safety score, max/avg error bound, FP16/BF16/kept counts,
  estimated speedup (roofline proxy), bandwidth savings.
- New endpoints: **`GET /api/examples`** (kernel gallery) and
  **`POST /api/sarif`** (SARIF 2.1.0 export for GitHub code scanning).
- Analyzer unit tests expanded to **14**.

### Frontend
- **Monaco (VS Code) editor** — bundled, no CDN; custom theme.
- **Annotated source view** — the editor itself is painted with per-line
  decorations (teal `__fp16`, amber `__bf16`, rose kept) and hover cards showing
  score, target, error bound, and block reason.
- **Redesigned dashboard** — radial safety-score gauge, target-type breakdown,
  speedup / memory / error-bound stat cards, FP32/FP16/BF16 comparison.
- **Variable table** with score bars, target-type badges, and error columns.
- **Dependency graph** coloured by recommended type.
- **Export menu** — rewritten source, JSON, or SARIF.
- **Example gallery** loaded from the backend.

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
