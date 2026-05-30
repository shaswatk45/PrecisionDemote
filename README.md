# PrecisionDemote — FP32 → FP16 Precision Demotion Tool

> A real Clang/LLVM LibTooling application that statically analyzes C/C++ floating-point computation chains and automatically demotes safe variables from `float` (FP32) to `__fp16` using heuristic-based backward precision propagation.

---

## Table of Contents

- [What Is This?](#what-is-this)
- [System Architecture](#system-architecture)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [How to Run](#how-to-run)
  - [Step 1 — Build the Clang Tool](#step-1--build-the-clang-tool)
  - [Step 2 — Run the Backend](#step-2--run-the-backend)
  - [Step 3 — Run the Frontend](#step-3--run-the-frontend)
  - [Step 4 — Run Test Cases](#step-4--run-test-cases)
- [CLI Usage](#cli-usage)
- [Heuristic Rules](#heuristic-rules)
- [Example Transformation](#example-transformation)
- [Project Structure](#project-structure)
- [Technologies Used](#technologies-used)
- [License](#license)

---

## What Is This?

**PrecisionDemote** is a compiler-infrastructure tool that performs *precision-aware type demotion* — automatically identifying floating-point variables that can safely be narrowed from 32-bit (`float`) to 16-bit (`__fp16`) without introducing significant numerical error.

This is directly relevant to AI/HPC workloads where mixed-precision computation (e.g., in neural network inference) reduces memory bandwidth and improves throughput on modern hardware (ARM, NVIDIA, Intel).

**What it does:**
1. Parses real C/C++ source code using Clang's AST (Abstract Syntax Tree)
2. Traverses every function and detects all `float` variable declarations
3. Builds a **dependency graph** of arithmetic computation chains
4. Evaluates each variable against 5 heuristic safety rules
5. Rewrites safe `float` declarations to `__fp16` using `clang::Rewriter`
6. Outputs a JSON analysis report + the transformed source code
7. Visualizes results in a React dashboard (dependency graph, diff viewer, metrics)

---

## System Architecture

```
┌────────────────────────────────────┐
│         User / Browser             │
│    React + Vite Frontend (3000)    │
└────────────────┬───────────────────┘
                 │ HTTP (REST API)
                 ▼
┌────────────────────────────────────┐
│   Node.js / Express Backend (4000) │
│   • File upload (multer)           │
│   • Fallback JS analyzer           │
│   • Metrics computation            │
└────────────────┬───────────────────┘
                 │ WSL subprocess call
                 ▼
┌────────────────────────────────────┐
│   Clang LibTooling Engine (Linux)  │
│   • RecursiveASTVisitor            │
│   • Heuristic Engine               │
│   • clang::Rewriter                │
└────────────────┬───────────────────┘
                 │
                 ▼
     analysis.json + rewritten source
```

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/PrecisionDemote.git
cd PrecisionDemote

# 2. Build (requires WSL Ubuntu with LLVM 18)
./build.sh

# 3. Run backend + frontend
./run.sh
```

Open **http://localhost:3000** to use the dashboard.

---

## Prerequisites

| Software | Version | Where |
|---|---|---|
| **Ubuntu (WSL)** | 22.04+ | Windows Subsystem for Linux |
| **LLVM + Clang** | 18.x | `sudo apt install llvm-18 clang-18 libclang-18-dev` |
| **CMake** | 3.16+ | `sudo apt install cmake` |
| **Node.js** | 18+ | https://nodejs.org |
| **npm** | 9+ | bundled with Node.js |
| **Python** | 3.8+ | For test validation scripts |

### Install LLVM 18 in WSL

```bash
sudo apt-get update
sudo apt-get install -y llvm-18 clang-18 libclang-18-dev \
     libllvm18 llvm-18-dev cmake ninja-build build-essential
```

---

## How to Run

### Step 1 — Build the Clang Tool

```bash
./build.sh
```

This runs inside WSL and produces `clang-tool/build/precision-demote`.

**Manual build (inside WSL):**
```bash
cd clang-tool
mkdir -p build && cd build
cmake .. \
  -DLLVM_DIR=/usr/lib/llvm-18/lib/cmake/llvm \
  -DClang_DIR=/usr/lib/llvm-18/lib/cmake/clang \
  -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
```

**Expected output:**
```
[precision-demote] Functions analyzed: 6
[precision-demote] Float variables:    18
[precision-demote] Safe to demote:     13 / 18
```

---

### Step 2 — Run the Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs at **http://localhost:4000**

The backend:
- Accepts C/C++ file uploads via `POST /api/analyze`
- Accepts inline code via `POST /api/analyze-text`
- Falls back to a JavaScript heuristic engine if the Clang tool isn't available

---

### Step 3 — Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**

---

### Step 4 — Run Test Cases

```bash
./run.sh
```

Or manually (inside WSL):
```bash
cd clang-tool/build

# Run all test cases
./precision-demote ../../tests/test_kernels.cpp \
  --output-json ../../tests/analysis_result.json -- -std=c++17

# Dry-run mode (no rewriting)
./precision-demote ../../tests/test_kernels.cpp \
  --dry-run -- -std=c++17

# Custom thresholds
./precision-demote ../../tests/test_kernels.cpp \
  --max-depth=5 --max-fan-in=10 -- -std=c++17
```

---

## CLI Usage

```
USAGE: precision-demote [options] <source-file> -- [compiler-flags]

Options:
  --output-json <path>   Path for JSON output (default: analysis.json)
  --dry-run              Analyze only — do not rewrite source
  --max-depth <N>        Max arithmetic chain depth for safe demotion (default: 3)
  --max-fan-in <N>       Max dependency fan-in for safe demotion (default: 5)
```

---

## Heuristic Rules

Variables are demoted to `__fp16` **only if all** conditions are satisfied:

| Rule | Condition | Rationale |
|---|---|---|
| **Type Check** | Must be `float` (not `double`) | Only FP32→FP16 is supported |
| **Accumulator Check** | No `+=`, `-=`, `*=`, `/=` assignments | Accumulators grow error over iterations |
| **Arithmetic Depth** | Expression depth ≤ `--max-depth` (default 3) | Deep chains amplify rounding error |
| **Division Check** | No `/` or `%` in computation chain | Division in FP16 has poor precision |
| **Dependency Fan-in** | ≤ `--max-fan-in` dependencies (default 5) | High fan-in risks correlated errors |

---

## Example Transformation

**Input (`test_kernels.cpp`):**
```c
float dot_product(float* a, float* b, int n) {
    float sum = 0.0f;        // accumulates — KEPT
    for (int i = 0; i < n; i++) {
        float ai   = a[i];   // depth 0 — SAFE
        float bi   = b[i];   // depth 0 — SAFE
        float prod = ai * bi; // depth 1 — SAFE
        sum += prod;
    }
    return sum;
}
```

**Output (rewritten):**
```c
float dot_product(float* a, float* b, int n) {
    float sum = 0.0f;         // accumulates — KEPT
    for (int i = 0; i < n; i++) {
        __fp16 ai   = a[i];   // DEMOTED
        __fp16 bi   = b[i];   // DEMOTED
        __fp16 prod = ai * bi; // DEMOTED
        sum += prod;
    }
    return sum;
}
```

---

## Project Structure

```
PrecisionDemote/
├── build.sh                  ← Build script (runs CMake in WSL)
├── run.sh                    ← Run script (tool + backend + frontend)
├── README.md                 ← This file
├── DESIGN.md                 ← Design approach and alternatives
├── IMPLEMENTATION.md         ← LLVM/Clang implementation details
├── EVALUATION.md             ← Metrics, test cases, comparison
│
├── clang-tool/
│   ├── CMakeLists.txt        ← CMake build config
│   └── src/
│       └── main.cpp          ← Full Clang LibTooling implementation
│
├── backend/
│   ├── server.js             ← Express API server
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/       ← Dashboard components
│   │   └── pages/
│   ├── package.json
│   └── vite.config.js
│
└── tests/
    ├── test_kernels.cpp      ← Primary test suite (6 functions)
    ├── tc_accumulator.cpp    ← TC1: Accumulator detection
    ├── tc_division.cpp       ← TC2: Division blocking
    ├── tc_depth.cpp          ← TC3: Deep chain blocking
    ├── tc_simple.cpp         ← TC4: Simple safe demotion
    ├── tc_fanin.cpp          ← TC5: Fan-in limit
    ├── tc_mixed.cpp          ← TC6: Mixed safe/unsafe
    ├── tc_double.cpp         ← TC7: Double type (not demoted)
    ├── validate_tests.py     ← Automated test validation script
    ├── extract_rewritten.py  ← Utility: print rewritten source
    ├── expected_output.cpp   ← Expected rewritten test_kernels.cpp
    └── analysis_result.json  ← Saved analysis output
```

---

## Technologies Used

| Layer | Technology |
|---|---|
| **Core Engine** | LLVM 18, Clang LibTooling, RecursiveASTVisitor, clang::Rewriter |
| **Build System** | CMake 3.16+ |
| **Backend** | Node.js 18, Express.js, Multer, fs-extra |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Testing** | Python 3, shell scripts |

---

## License

MIT License — see [LICENSE](LICENSE) for details.
#   P r e c i s i o n R e m o t e  
 