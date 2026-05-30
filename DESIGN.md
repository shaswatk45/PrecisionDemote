# DESIGN — PrecisionDemote

## Problem Statement

Modern AI and HPC workloads increasingly use **mixed-precision arithmetic** to reduce memory bandwidth and accelerate inference. GPUs and ARM cores expose 16-bit floating-point (`__fp16` / `half`) units, but manually annotating source code for FP16 is tedious and error-prone.

**Goal:** Build a static analysis tool that automatically identifies `float` (FP32) variables that are *safe* to narrow to `__fp16` (FP16) and rewrites the source without changing program semantics.

---

## Design Philosophy

The core principle is **conservative safety**: when in doubt, keep `float`. A false *negative* (keeping a variable at FP32 when FP16 would be fine) is harmless — the code runs correctly, just without the optimization. A false *positive* (demoting a variable that should stay FP32) would introduce numerical errors or program bugs.

This drives every design decision below.

---

## High-Level Architecture

```
C/C++ Source File
       │
       ▼  (Clang parser — full AST)
RecursiveASTVisitor
       │
       ├── Pass 1: Collect all float VarDecls per function
       │
       ├── Pass 2: Detect accumulators (+=, -=, *=, /=)
       │
       └── Pass 3: Build FPNode dependency graph
                   │
                   ├── computeExprDepth()    — arithmetic chain depth
                   ├── exprContainsDivision() — division detection
                   └── collectVarRefs()       — dependency edges
                         │
                         ▼
                 evaluateHeuristics()
                         │
                         ▼
                 clang::Rewriter (source rewriting)
                         │
                         ▼
           JSON report + rewritten .cpp
```

### Full-Stack Architecture

```
Browser (React)
    │  REST API (JSON)
    ▼
Express.js Backend (Node.js)
    │  WSL subprocess
    ▼
precision-demote (Clang LibTooling binary, runs in WSL/Linux)
    │
    ▼
LLVM 18 / Clang AST
```

The backend is intentionally a *thin adapter*: it handles file uploads, invokes the Clang binary via WSL, and parses its JSON output. When the Clang tool is unavailable (Windows without WSL), a JavaScript fallback analyzer provides approximate results.

---

## Key Design Decisions

### 1. Real AST vs. Regex/Text Analysis

| Approach | Pros | Cons |
|---|---|---|
| **Clang AST (chosen)** | Semantically correct, handles macros, templates, casts | Requires LLVM build toolchain |
| Regex on source | Simple, no dependencies | Misses casts, macros, multi-line exprs |
| GCC GIMPLE plugin | Closer to codegen, sees optimization | Much harder to integrate, GCC-only |
| LLVM IR pass | Post-type-erasure opportunities | `float` type info partially lost in IR |

**Decision:** Clang AST via LibTooling is the only approach that correctly handles implicit casts, parenthesized expressions, conditional operators, and multi-statement chains without false positives.

### 2. `RecursiveASTVisitor` vs. `ASTMatcher`

| Approach | Pros | Cons |
|---|---|---|
| **RecursiveASTVisitor (chosen)** | Full control over traversal, stateful per-function | More boilerplate |
| ASTMatcher | Declarative, concise patterns | Harder to build stateful cross-variable analysis |

**Decision:** Because we need to build a *per-function dependency graph* (tracking all float vars and their relationships), `RecursiveASTVisitor` gives us the fine-grained control to run three ordered passes within a single function visit.

### 3. Source-Level Rewriting vs. IR/Bitcode Transformation

| Approach | Pros | Cons |
|---|---|---|
| **clang::Rewriter (chosen)** | Preserves comments, formatting; human-readable | Must track exact SourceRange of type token |
| Emit modified LLVM IR | Works post-compilation | Cannot easily trace back to user's source |
| Generate patch/diff | Non-destructive | Requires separate apply step |

**Decision:** `clang::Rewriter` rewrites the *source* token range of the `float` keyword, preserving all surrounding code (comments, whitespace). This lets the developer review the change directly.

### 4. Heuristic Rules — Why These Five?

The five rules are chosen to form a *sufficient condition* for safety with low false-positive rate:

| Rule | Why it blocks demotion |
|---|---|
| `qualType == "float"` | We only handle FP32→FP16; doubles or typedefs are excluded |
| `!isAccumulator` | `sum += x` across N iterations accumulates O(N·ε) error — catastrophic in FP16 |
| `depth ≤ maxDepth` | Each arithmetic op adds ~0.1% relative error; depth > 3 risks > 0.5% compounding |
| `!hasDivision` | FP16 division has much lower precision near denominators close to zero |
| `depCount ≤ maxFanIn` | High fan-in means many error sources feeding into one variable |

Rules are **composable** — the heuristic engine is a single function `evaluateHeuristics()` that can be extended with new rules without touching the AST traversal.

### 5. Transitive Depth Propagation

A critical design choice is computing *transitive* depth, not just local expression depth:

```cpp
float a = x * y;       // local depth = 1
float b = a + z;       // local depth = 1, but transitive depth = 2 (1 + depth(a))
float c = b / 2.0f;    // transitive depth = 3, + has division → BLOCKED
```

The tool maintains a `varDepthMap` and `hasDivision` flags that propagate forward through the dependency graph in declaration order, so downstream variables inherit the "taint" of their predecessors.

### 6. Fallback Mode

The backend includes a JavaScript fallback analyzer that mirrors the same heuristics using regex-based parsing. This ensures the frontend dashboard remains usable on machines without WSL/LLVM installed, at the cost of slightly less accurate analysis (no macro expansion, no implicit cast handling).

---

## Alternatives Considered and Rejected

### A. LLVM Optimization Pass (FunctionPass / ModulePass)

**Why rejected:** By the time code reaches LLVM IR, `float` variables that survive are in SSA form. Type information is partially preserved but the structural connection to source variable names is lost. Rewriting the IR cannot produce human-readable source output, which is a core requirement of this project.

### B. Clang Tidy Check

**Why rejected:** Clang Tidy checks are designed to emit *warnings*, not to rewrite type annotations across a dependency graph. Building a custom Tidy check with full cross-variable state tracking is more complex than a standalone LibTooling tool.

### C. Python libclang Bindings

**Why rejected:** Python's `libclang` bindings expose a limited subset of the Clang API. In particular, `clang::Rewriter` and full `SourceRange` manipulation are not available through Python bindings.

### D. Static Single Assignment (SSA) Value Ranging

**Why considered:** LLVM's Value Range Analysis could theoretically determine if a variable always holds values within `[-65504, 65504]` (FP16 range), enabling more precise demotion. **Why rejected:** This requires full inter-procedural analysis, is unsound without runtime profiling data, and was beyond the project scope.

---

## Extensibility

The design supports future extensions:

| Extension | Where to Add |
|---|---|
| Support `double` → `float` demotion | Add second pass in `collectFloatVarsInStmt()` |
| Profile-guided demotion (add runtime range checks) | Add pre/post instrumentation pass |
| New heuristic rule (e.g., loop count threshold) | Add condition in `evaluateHeuristics()` |
| IDE plugin (LSP) | Wrap the JSON output in an LSP diagnostic |
| Batch analysis of entire codebase | Use `ClangTool` with a compilation database |

---

## Limitations

1. **Alias analysis not performed** — if two `float*` pointers alias, the tool may miss an accumulation pattern.
2. **No inter-procedural analysis** — a variable passed to a function that accumulates it is not detected as unsafe.
3. **Template instantiations** — generic `template<typename T>` functions are not analyzed (only concrete `float` instantiations).
4. **`__fp16` compatibility** — `__fp16` is an ARM/GCC extension; it is not standard C++ and requires ARM or RISC-V hardware for full hardware acceleration.
