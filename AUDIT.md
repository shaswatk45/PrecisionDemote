# PrecisionDemote — Audit & v2.0 Overhaul

This document records a full audit of the project and the changes made in the
**v2.0** overhaul. Every finding below was reproduced against the real build
(LLVM 18.1.3, Node 22) before being fixed, and every fix was re-verified.

---

## Summary

| Area | Finding | Severity | Status |
|---|---|---|---|
| Tests | Advertised "73/73 100%" was not reproducible — real baseline was **56/57**, with TC5 failing | High | ✅ Fixed |
| Tests | `double_only` variables were **silently skipped** by the validator (never actually checked) | High | ✅ Fixed |
| Backend | **Command injection** — file paths interpolated into a shell string passed to `execSync` | High | ✅ Fixed |
| Backend | No rate limiting or security headers on subprocess-spawning endpoints | Medium | ✅ Fixed |
| Schema | JSON key typo `safeTodemote` (lowercase `d`) papered over by a normalizer | Medium | ✅ Fixed |
| UI/analysis | "Why was this kept?" was **re-derived in the frontend**, able to disagree with the analyzer | Medium | ✅ Fixed |
| Frontend | Theme drift — Tailwind `safe`/`unsafe` tokens (grey / dark-red) didn't match the charts and diff (teal / rose) | Low | ✅ Fixed |
| Frontend | No export/copy of the rewritten source; no error boundary | Low | ✅ Fixed |

---

## Findings in detail

### 1. The test suite did not actually pass at 100%

The README and `EVALUATION.md` advertised **73/73 checks, 100%**. Building the
tool from a clean checkout and running the bundled validator produced:

```
Total checks: 57
Passed:       56
Failed:       1   (TC5)
```

Two distinct problems:

- **TC5 (fan-in) conflated two rules.** The test wrote
  `mid_fanin = v1 + v2 + v3 + v4 + v5`, expecting it to be SAFE at the fan-in
  limit of 5. But a left-leaning sum of 5 operands has **arithmetic depth 4**,
  which trips the depth rule (`> 3`) *before* fan-in is ever evaluated. The
  variable can never be safe under the default thresholds, so the expectation
  was impossible.
  **Fix:** rewrote the initializers as *balanced* trees
  (`(v1 + v2 + v3) + (v4 + v5)`) so depth stays at 3, isolating the fan-in rule
  as intended.

- **TC7 (`double_only`) checks were silently skipped.** The Clang tool only
  collected `float` locals, and functions with zero float nodes were dropped
  from the JSON entirely. The validator then printed
  `⚠ Function 'double_only' not found in output` and **did not count** those
  three checks — so a whole test case was quietly not being validated.
  **Fix:** the analyzer now also collects `double` locals and emits them as
  **type-blocked** nodes (never demoted). `double_only` now appears in the
  output and its variables are genuinely asserted KEPT.

**After the fix:** `60/60` checks pass — and the count went *up* because three
previously-skipped checks now actually run.

### 2. Command injection in the backend

`backend/server.js` built WSL commands by string-interpolating file paths into a
shell command run via `execSync`:

```js
const cmd = `wsl -d ${WSL_DISTRO} -- "${TOOL_WSL_PATH}" "${wslSrc}" ...`;
execSync(cmd, ...);
```

A crafted upload filename could break out of the quotes and inject shell
commands. **Fix:** all subprocess calls now use `execFileSync('wsl', [...args])`
with an **argument array**, so arguments are passed to the process literally and
never parsed by a shell. Uploaded files are additionally stored under a UUID
name with only a whitelisted extension.

### 3. Backend hardening

Added, without new dependencies:

- **Security headers** (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Cross-Origin-Resource-Policy`).
- **In-memory sliding-window rate limiter** on the analysis endpoints (spawning
  a compiler subprocess per request is otherwise a cheap DoS).
- **Configurable CORS allow-list** via `ALLOWED_ORIGINS`.

### 4. Schema correctness & single source of truth

- Fixed the `safeTodemote` → **`safeToDemote`** key typo at the source (the
  normalizer still accepts the old key for back-compat).
- The analyzer now emits a **`blockReason`** on every node
  (`""` | `type` | `accumulator` | `division` | `depth` | `fan-in`). The UI maps
  that code to prose instead of re-deriving the reason and risking disagreement
  with the analyzer.
- JSON is now **self-describing**: `toolVersion`, `engine`, and the
  `thresholds` used are included so consumers stop hard-coding `3` / `5`.

### 5. Frontend

- Unified the palette: `safe = teal (#14b8a6)`, `unsafe = rose (#f43f5e)` to
  match the charts and the diff highlight; brand `accent` moved to indigo so a
  call-to-action never reads as a warning.
- Added **Copy** and **Download** for the rewritten source, a React
  **error boundary**, a footer, `Ctrl/⌘+Enter` to analyze, and ARIA labels.

---

## How to reproduce

```bash
./build.sh                                             # build the Clang tool (WSL + LLVM 18)
python3 tests/validate_tests.py clang-tool/build/precision-demote   # 60/60
cd backend && npm install && npm test                  # 9/9 analyzer unit tests
cd ../frontend && npm install && npm run build         # production build
```
