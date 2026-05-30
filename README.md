<div align="center">

# 🔬 PrecisionDemote

### Automatic FP32 → FP16 Precision Demotion via Clang LibTooling

[![LLVM](https://img.shields.io/badge/LLVM-18.x-blue?logo=llvm&logoColor=white)](https://llvm.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20WSL-orange?logo=linux)](https://learn.microsoft.com/en-us/windows/wsl/)
[![Language](https://img.shields.io/badge/Language-C%2B%2B17-blue?logo=cplusplus)](https://en.cppreference.com/w/cpp/17)
[![Node](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)

<br/>

> A real **Clang AST-based** compiler tool that statically analyzes C/C++ floating-point computation chains and **automatically rewrites** safe `float` (FP32) variables to `__fp16` (FP16) — enabling mixed-precision optimization for AI/HPC workloads without manual effort.

<br/>

```
float ai   = a[i];      →     __fp16 ai   = a[i];
float bi   = b[i];      →     __fp16 bi   = b[i];
float prod = ai * bi;   →     __fp16 prod = ai * bi;
float sum  = 0.0f;      →     float  sum  = 0.0f;   // accumulator — kept
```

</div>

---

## 📑 Table of Contents

- [What Is This?](#-what-is-this)
- [How It Works](#-how-it-works)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [CLI Usage](#-cli-usage)
- [Heuristic Rules](#-heuristic-rules)
- [Test Results](#-test-results)
- [Project Structure](#-project-structure)
- [Technologies](#-technologies)
- [Documents](#-documents)
- [License](#-license)

---

## 🎯 What Is This?

Modern AI accelerators (NVIDIA Tensor Cores, ARM, Intel AMX) provide native **FP16 (half-precision)** execution units that deliver 2× memory bandwidth savings and significantly faster matrix operations. However, naively converting all `float` variables to `__fp16` introduces unacceptable numerical error.

**PrecisionDemote** solves this by performing **static precision analysis**:
- Parses real C/C++ source code using **Clang's Abstract Syntax Tree**
- Builds a **variable dependency graph** per function
- Applies **5 safety heuristics** to identify variables safe to narrow
- **Rewrites the source** using `clang::Rewriter` — preserving all comments and formatting
- Outputs a **JSON analysis report** consumed by a React dashboard

**Result on `test_kernels.cpp`:** 13 out of 18 float variables safely demoted (72.2%) with **zero false positives**.

---

## ⚙️ How It Works

```
C/C++ Source File
       │
       ▼ (Clang full parse + sema)
RecursiveASTVisitor
       │
       ├─ Pass 1 ─ Collect all local float VarDecls per function
       ├─ Pass 2 ─ Detect accumulators  (+=  -=  *=  /=)
       └─ Pass 3 ─ Build dependency graph
                        │
                        ├─ computeExprDepth()      arithmetic chain depth
                        ├─ exprContainsDivision()  division flag (transitive)
                        └─ collectVarRefs()         inter-variable edges
                              │
                              ▼
                    evaluateHeuristics()    5 safety rules
                              │
                              ▼
                    clang::Rewriter         float → __fp16 in-place
                              │
                              ▼
              analysis.json  +  rewritten source
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Browser (React + Vite)        │
│   Code Diff  │  Dep Graph  │  Metrics   │
└──────────────┬──────────────────────────┘
               │  REST API (JSON)
               ▼
┌─────────────────────────────────────────┐
│   Node.js / Express Backend  :4000      │
│   • File upload (multer)                │
│   • WSL subprocess bridge               │
│   • JS fallback analyzer                │
└──────────────┬──────────────────────────┘
               │  WSL subprocess
               ▼
┌─────────────────────────────────────────┐
│   precision-demote  (Clang LibTooling)  │
│   Built against LLVM 18 / Ubuntu WSL    │
│   RecursiveASTVisitor + Rewriter        │
└─────────────────────────────────────────┘
```

---

## 🛠️ Prerequisites

| Requirement | Version | Install |
|---|---|---|
| **Ubuntu / WSL** | 22.04 LTS+ | [WSL install guide](https://learn.microsoft.com/en-us/windows/wsl/install) |
| **LLVM + Clang** | 18.x | See below |
| **CMake** | 3.16+ | `sudo apt install cmake` |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **npm** | 9+ | Bundled with Node.js |
| **Python** | 3.8+ | `sudo apt install python3` |

**Install LLVM 18 inside WSL:**
```bash
sudo apt-get update
sudo apt-get install -y \
  llvm-18 clang-18 libclang-18-dev \
  libllvm18 llvm-18-dev cmake build-essential
```

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/shaswatk45/PrecisionDemote.git
cd PrecisionDemote

# 2. Build the Clang tool (runs inside WSL automatically)
./build.sh

# 3. Run tool + tests + start the web dashboard
./run.sh
```

Open **http://localhost:3000** in your browser.

---

## 📦 Step-by-Step

### Step 1 — Build

```bash
./build.sh
```

What it does:
- Checks for LLVM 18, CMake, make inside WSL
- Runs `cmake .. -DLLVM_DIR=... -DClang_DIR=...`
- Builds the binary at `clang-tool/build/precision-demote`
- Runs a smoke test against `tests/test_kernels.cpp`

Expected output:
```
[precision-demote] Functions analyzed: 6
[precision-demote] Float variables:    18
[precision-demote] Safe to demote:     13 / 18
```

### Step 2 — Run the Tool

```bash
# Full analysis
./run.sh --tool-only

# Or manually inside WSL:
./clang-tool/build/precision-demote tests/test_kernels.cpp \
  --output-json tests/analysis_result.json -- -std=c++17
```

### Step 3 — Run Tests

```bash
./run.sh --tests
# or
python3 tests/validate_tests.py clang-tool/build/precision-demote
```

### Step 4 — Launch Dashboard

```bash
./run.sh --servers
```

| Server | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Health check | http://localhost:4000/api/health |

---

## 💻 CLI Usage

```
USAGE: precision-demote [options] <source.cpp> -- [compiler-flags]

Options:
  --output-json <path>    JSON output path  (default: analysis.json)
  --dry-run               Analyze only, do not rewrite source
  --max-depth <N>         Max arithmetic chain depth  (default: 3)
  --max-fan-in <N>        Max dependency fan-in        (default: 5)

Examples:
  ./precision-demote input.cpp --output-json out.json -- -std=c++17
  ./precision-demote input.cpp --dry-run -- -std=c++17
  ./precision-demote input.cpp --max-depth=5 --max-fan-in=10 -- -std=c++17
```

---

## 🧠 Heuristic Rules

A variable is demoted **only if all 5 rules pass**. When in doubt, the tool keeps `float`.

| # | Rule | Condition | Rationale |
|---|---|---|---|
| 1 | **Type check** | Must be `float` (not `double`) | Only FP32→FP16 is in scope |
| 2 | **Accumulator check** | No `+=` / `-=` / `*=` / `/=` | Accumulation amplifies error over N iterations |
| 3 | **Depth limit** | Arithmetic chain depth ≤ `--max-depth` (3) | Deep chains compound rounding error |
| 4 | **Division check** | No `/` or `%` anywhere in dependency chain | FP16 division has poor precision near zero |
| 5 | **Fan-in limit** | ≤ `--max-fan-in` (5) float variable dependencies | High fan-in risks correlated errors |

### Example

```cpp
// BEFORE
float sum  = 0.0f;         // Rule 2: accumulator  → KEPT
float ai   = a[i];         // depth 0, no division → DEMOTED ✓
float bi   = b[i];         // depth 0, no division → DEMOTED ✓
float prod = ai * bi;      // depth 1, 2 deps      → DEMOTED ✓
float inv  = 1.0f / norm;  // Rule 4: division     → KEPT

// AFTER (tool output)
float  sum  = 0.0f;
__fp16 ai   = a[i];
__fp16 bi   = b[i];
__fp16 prod = ai * bi;
float  inv  = 1.0f / norm;
```

---

## 📊 Test Results

### Summary

| Test Case | Description | Checks | Result |
|---|---|---|---|
| **TC0** — `test_kernels.cpp` | Primary 6-function suite | 18/18 | ✅ 100% |
| **TC1** — `tc_accumulator.cpp` | `+=` and `*=` detection | 6/6 | ✅ 100% |
| **TC2** — `tc_division.cpp` | Direct + inherited division | 6/6 | ✅ 100% |
| **TC3** — `tc_depth.cpp` | Depth boundary at exactly 3 | 6/6 | ✅ 100% |
| **TC4** — `tc_simple.cpp` | Positive: all safe (no over-blocking) | 11/11 | ✅ 100% |
| **TC5** — `tc_fanin.cpp` | Fan-in boundary at exactly 5 | 8/8 | ✅ 100% |
| **TC6** — `tc_mixed.cpp` | Realistic layer-norm kernel | 10/10 | ✅ 100% |
| **TC7** — `tc_double.cpp` | `double` type never demoted | 8/8 | ✅ 100% |
| **TOTAL** | | **73/73** | ✅ **100%** |

### Baseline Comparison

| Metric | Manual Annotation | **PrecisionDemote** |
|---|---|---|
| Time | ~12 minutes | **< 1 second** |
| False positives | 1 (missed division case) | **0** |
| False negatives | 0 | **0** |
| Precision | 92.3% | **100%** |
| Recall | 100% | **100%** |

### Memory Impact (on `test_kernels.cpp`)

```
Total float vars:   18
Safe to demote:     13  (72.2%)
Memory saved:       13 × 2 bytes = 26 bytes per invocation
Relative savings:   ~36.1% vs all-FP32
Max relative error: ~0.1% per FP16 operation
```

---

## 📁 Project Structure

```
PrecisionDemote/
│
├── build.sh                   ← Build script (WSL + CMake)
├── run.sh                     ← Run script (tool + tests + servers)
├── README.md                  ← This file
├── DESIGN.md                  ← Architecture + design decisions
├── IMPLEMENTATION.md          ← LLVM/Clang internals walkthrough
├── EVALUATION.md              ← Full metrics, test tables, comparisons
├── LICENSE                    ← MIT
│
├── clang-tool/
│   ├── CMakeLists.txt         ← Links against LLVM 18 shared libs
│   └── src/
│       └── main.cpp           ← 547-line Clang LibTooling implementation
│
├── backend/
│   ├── server.js              ← Express API + WSL bridge + JS fallback
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/        ← CodeDiff, GraphPanel, MetricsPanel, NodeTable
│   │   └── pages/             ← HomePage, AnalysisPage
│   └── package.json
│
└── tests/
    ├── test_kernels.cpp        ← Primary 6-function test suite
    ├── tc_accumulator.cpp      ← TC1: accumulator detection
    ├── tc_division.cpp         ← TC2: division blocking
    ├── tc_depth.cpp            ← TC3: depth limit
    ├── tc_simple.cpp           ← TC4: all-safe positive case
    ├── tc_fanin.cpp            ← TC5: fan-in limit
    ├── tc_mixed.cpp            ← TC6: realistic mixed kernel
    ├── tc_double.cpp           ← TC7: double type exclusion
    ├── validate_tests.py       ← Automated validator (73 checks)
    ├── expected_output.cpp     ← Reference rewritten output
    └── analysis_result.json    ← Pre-computed analysis output
```

---

## 🧰 Technologies

| Layer | Stack |
|---|---|
| **Core Engine** | LLVM 18, Clang LibTooling, `RecursiveASTVisitor`, `clang::Rewriter` |
| **Build** | CMake 3.16+, GCC/Clang, WSL Ubuntu 22.04 |
| **Backend** | Node.js 18, Express.js, Multer, fs-extra |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Testing** | Python 3, Bash scripts |

---

## 📄 Documents

| Document | Contents |
|---|---|
| [`DESIGN.md`](DESIGN.md) | Problem statement, design decisions, alternatives rejected |
| [`IMPLEMENTATION.md`](IMPLEMENTATION.md) | LLVM/Clang API walkthrough, algorithm, JSON schema |
| [`EVALUATION.md`](EVALUATION.md) | Full test tables, baseline comparison, failure cases |

---

## 📜 License

[MIT License](LICENSE) © 2026 PrecisionDemote Contributors