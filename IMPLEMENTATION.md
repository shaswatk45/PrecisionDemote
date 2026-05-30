# IMPLEMENTATION — PrecisionDemote

## Overview

This document describes the internal implementation of the `precision-demote` Clang LibTooling binary (`clang-tool/src/main.cpp`). It covers the LLVM/Clang APIs used, data structures, algorithm walkthrough, and build system details.

---

## Build System

### CMake Configuration (`clang-tool/CMakeLists.txt`)

The project uses CMake to find and link against a pre-installed LLVM 18 package:

```cmake
find_package(LLVM REQUIRED CONFIG)
find_package(Clang REQUIRED CONFIG)
```

This uses LLVM's own CMake config files (shipped with the `llvm-18-dev` package on Ubuntu) to locate headers and libraries automatically.

**Key flags:**
- `CMAKE_CXX_STANDARD 17` — required by modern LLVM/Clang APIs
- `-fno-rtti` — LLVM is typically built without RTTI; our tool must match
- `USE_SHARED_LLVM ON` — links against `libLLVM-18.so` (shared) to avoid duplicate symbol issues on Debian/Ubuntu packages

**Linked Clang component libraries:**
```
clangTooling, clangBasic, clangASTMatchers, clangAST,
clangFrontend, clangSerialization, clangDriver,
clangParse, clangSema, clangAnalysis, clangEdit,
clangLex, clangRewrite, clangRewriteFrontend
```

---

## LLVM/Clang Entry Points

### `CommonOptionsParser`

```cpp
auto ExpParser = CommonOptionsParser::create(argc, argv, ToolCat,
                     llvm::cl::ZeroOrMore, "...");
ClangTool Tool(OP.getCompilations(), OP.getSourcePathList());
int Ret = Tool.run(newFrontendActionFactory<FPAction>().get());
```

`ClangTool` is the standard entry point for out-of-tree Clang tools. It accepts a compilation database or inline compiler flags (via `--`) and invokes the provided `FrontendAction` on each input file.

### `FPAction : ASTFrontendAction`

```cpp
class FPAction : public ASTFrontendAction {
    std::unique_ptr<ASTConsumer>
    CreateASTConsumer(CompilerInstance &CI, StringRef File) override {
        Rw_.setSourceMgr(CI.getSourceManager(), CI.getLangOpts());
        return std::make_unique<FPConsumer>(CI.getASTContext(), Rw_);
    }
    Rewriter Rw_;
};
```

`ASTFrontendAction` sets up a full Clang compilation pipeline (preprocessing, parsing, sema) and hands us an `ASTConsumer` once the AST is ready.

### `FPConsumer : ASTConsumer`

```cpp
void HandleTranslationUnit(ASTContext &Ctx) override {
    Visitor_.TraverseDecl(Ctx.getTranslationUnitDecl());
    // ... capture original source, apply rewrites
}
```

`HandleTranslationUnit` is called exactly once after the entire TU is parsed. This is where we:
1. Run the visitor
2. Capture the original source buffer
3. Apply all rewrites for safe nodes
4. Extract the rewritten buffer

---

## Core Data Structures

### `FPNode`

Represents a single `float` variable declaration:

```cpp
struct FPNode {
    std::string name;           // variable name (e.g., "prod")
    std::string qualType;       // "float", "double", etc.
    unsigned    line, col;      // source location
    int         depth;          // transitive arithmetic expression depth
    bool        hasDivision;    // true if any division in dependency chain
    int         depCount;       // number of float variable dependencies
    bool        isAccumulator;  // true if used with +=, -=, *=, /=
    bool        isSafe;         // heuristic verdict
    SourceRange typeRange;      // source range of the "float" keyword
    std::vector<std::string> deps; // names of float vars this depends on
};
```

### `FuncResult`

Aggregates all FPNodes and dependency edges for one function:

```cpp
struct FuncResult {
    std::string name;
    std::vector<FPNode> nodes;
    std::vector<std::pair<std::string,std::string>> edges; // (from, to)
    int totalFloatVars;
    int safeToDemote;
};
```

### Global State

```cpp
static std::vector<FuncResult> GResults;       // one per function
static std::string             GOriginalSource; // raw source text
static std::string             GRewrittenSource;// post-rewrite source text
```

Using global state is acceptable here because `ClangTool` processes one file per tool run.

---

## Algorithm Walkthrough

### `FPVisitor::VisitFunctionDecl`

This is called for every function definition in the main file. It runs three sequential passes:

#### Pass 1 — Collect Float Variables

```cpp
collectFloatVarsInStmt(FD->getBody(), floatVarNames, floatVars);
```

Recursively walks all `Stmt` nodes to find `DeclStmt` → `VarDecl` nodes where:
- `VD->hasLocalStorage()` — local variables only
- `QT->isFloatingType()` — floating point type
- `!QT->isPointerType() && !QT->isArrayType()` — scalar only
- `ts == "float"` — exactly `float`, not `double` or `long double`

#### Pass 2 — Detect Accumulators

```cpp
detectAccumulators(FD->getBody(), floatVarNames, accumulators);
```

Recursively walks `BinaryOperator` nodes. If the operator is a compound assignment (`isCompoundAssignmentOp()`) and the LHS names a known float variable, that variable is marked as an accumulator.

```
sum += prod;  →  sum is compound-assigned  →  isAccumulator = true
```

#### Pass 3 — Build FPNodes

For each `VarDecl` collected in Pass 1:

1. **Expression depth** via `computeExprDepth(Init)`:
   - Each arithmetic binary op (`+`, `-`, `*`, `/`, `%`) adds 1 to depth
   - Depth is the *height* of the arithmetic expression tree
   - Call expressions are treated as depth-1 operators

2. **Division check** via `exprContainsDivision(Init)`:
   - Scans for `BO_Div` and `BO_Rem` operators

3. **Dependency collection** via `collectVarRefs(Init, deps, floatVarNames)`:
   - Walks `DeclRefExpr` nodes to find references to other known float vars

4. **Transitive depth**: `depth = localExprDepth + max(depth of deps)`
   - Uses `varDepthMap` cache keyed by variable name

5. **Division propagation**: if any dependency has `hasDivision == true`, the current node inherits it

6. **Heuristic evaluation** via `evaluateHeuristics(node, maxDepth, maxFanIn)`

---

## Expression Analysis Helpers

### `computeExprDepth(const Expr *E)`

Recursive descent over the expression AST:

```cpp
static int computeExprDepth(const Expr *E) {
    E = E->IgnoreParenImpCasts();  // strip parentheses and implicit casts
    
    if (auto *BO = dyn_cast<BinaryOperator>(E)) {
        if (BO->isAdditiveOp() || BO->isMultiplicativeOp() || BO_Rem)
            return 1 + max(depth(LHS), depth(RHS));
        // comparison/assignment operators don't count
        return max(depth(LHS), depth(RHS));
    }
    if (auto *CE = dyn_cast<CallExpr>(E))
        return 1 + max_arg_depth;  // math function calls count as depth 1
    // Leaves (literals, variable refs) return 0
    return 0;
}
```

Key detail: `IgnoreParenImpCasts()` is essential — without it, implicit casts inserted by Clang (e.g., `float` → `double` promotion) would be missed, and the visitor would see `ImplicitCastExpr` instead of the underlying `BinaryOperator`.

### `exprContainsDivision(const Expr *E)`

Simple recursive scan for `BO_Div` or `BO_Rem` at any depth in the expression tree.

### `collectVarRefs(const Expr *E, vector<string> &out, set<string> &floatVars)`

Walks all `DeclRefExpr` nodes and collects names that are in the `floatVars` set. Deduplicates using `std::find` before pushing.

---

## Heuristic Engine

```cpp
static bool evaluateHeuristics(FPNode &node, int maxDepth, int maxFanIn) {
    if (node.qualType != "float")    return false;  // Rule 1
    if (node.isAccumulator)          return false;  // Rule 2
    if (node.depth > maxDepth)       return false;  // Rule 3
    if (node.hasDivision)            return false;  // Rule 4
    if (node.depCount > maxFanIn)    return false;  // Rule 5
    return true;
}
```

Rules are checked in order of computational cost (cheapest first). All five must pass for `isSafe = true`.

---

## Source Rewriting

The `clang::Rewriter` is initialized in `FPAction::CreateASTConsumer` and passed to `FPConsumer`. After the visitor runs, the consumer performs rewrites:

```cpp
for (auto &node : fr.nodes) {
    if (!node.isSafe || !node.typeRange.isValid()) continue;
    
    SourceLocation Begin = SM.getSpellingLoc(node.typeRange.getBegin());
    if (!SM.isInMainFile(Begin)) continue;
    
    unsigned TokLen = Lexer::MeasureTokenLength(Begin, SM, LangOpts);
    const char *TokStart = SM.getCharacterData(Begin);
    
    // Safety: verify the token is actually "float" before overwriting
    if (TokStart && StringRef(TokStart, TokLen) == "float")
        Rw_.ReplaceText(Begin, TokLen, "__fp16");
}
```

Critical safety check: `StringRef(TokStart, TokLen) == "float"` — we verify the token spelling before rewriting to guard against stale `SourceRange` data.

The rewritten buffer is extracted via:
```cpp
const RewriteBuffer *RB = Rw_.getRewriteBufferFor(MainFID);
if (RB)
    GRewrittenSource = std::string(RB->begin(), RB->end());
```

---

## JSON Output Schema

```json
{
  "dryRun": false,
  "functions": [
    {
      "name": "dot_product",
      "totalFloatVars": 4,
      "safeTodemote": 3,
      "nodes": [
        {
          "name": "sum",
          "type": "float",
          "line": 15, "col": 11,
          "depth": 0,
          "hasDivision": false,
          "dependencyCount": 0,
          "isAccumulator": true,
          "isSafe": false,
          "deps": []
        }
      ],
      "edges": [
        { "from": "prod", "to": "ai" },
        { "from": "prod", "to": "bi" }
      ]
    }
  ],
  "originalSource": "...",
  "rewrittenSource": "..."
}
```

---

## CLI Options

Implemented via `llvm::cl`:

```cpp
static llvm::cl::opt<std::string> OutputJSON("output-json", ...);
static llvm::cl::opt<bool>        DryRun("dry-run", ...);
static llvm::cl::opt<int>         MaxDepth("max-depth", ..., cl::init(3));
static llvm::cl::opt<int>         MaxFanIn("max-fan-in", ..., cl::init(5));
```

`llvm::cl` integrates automatically with `CommonOptionsParser` and handles `--` separator between tool options and compiler flags.

---

## Backend Integration (`backend/server.js`)

The Express server bridges Windows and the WSL Clang binary:

```javascript
function toWSLPath(winPath) {
  const drive = resolved[0].toLowerCase();
  const rest = resolved.slice(2).replace(/\\/g, '/');
  return `/mnt/${drive}${rest}`;
}

function runClangTool(srcPath, outputJsonPath) {
  const cmd = `wsl -d ${WSL_DISTRO} -- "${TOOL_WSL_PATH}" "${wslSrc}" \
               --output-json "${wslOut}" -- -std=c++17`;
  execSync(cmd, { timeout: 30000 });
  return fs.readJsonSync(outputJsonPath);
}
```

**Fallback mode:** If `wsl -d Ubuntu -- test -x <tool>` fails, the server falls back to a JavaScript implementation of the same heuristics (regex-based, operating on stripped source text).

---

## Lines of Code Summary

| File | Lines | Purpose |
|---|---|---|
| `clang-tool/src/main.cpp` | 547 | Full Clang LibTooling implementation |
| `clang-tool/CMakeLists.txt` | 59 | Build configuration |
| `backend/server.js` | 306 | REST API + fallback analyzer |
| `tests/test_kernels.cpp` | 68 | Primary test suite |
| `tests/validate_tests.py` | ~150 | Automated test runner |
| `tests/tc_*.cpp` | ~30 each | Individual test cases |
