#!/usr/bin/env bash
# =============================================================================
# run.sh — PrecisionDemote Run Script
#
# Runs all components of the project:
#   1. Clang tool against the test suite
#   2. Automated test validation
#   3. Backend API server (Node.js)
#   4. Frontend dev server (React/Vite)
#
# Usage:
#   ./run.sh               # Run tool + tests + start servers
#   ./run.sh --tool-only   # Run Clang tool against test suite only
#   ./run.sh --tests       # Run automated test validation only
#   ./run.sh --servers     # Start backend + frontend servers only
#   ./run.sh --help        # Show help
#
# Prerequisites: ./build.sh must have been run first.
# =============================================================================

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[run]${NC} $*"; }
ok()   { echo -e "${GREEN}[run] ✓${NC} $*"; }
warn() { echo -e "${YELLOW}[run] ⚠${NC} $*"; }
err()  { echo -e "${RED}[run] ✗${NC} $*"; exit 1; }
hdr()  { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }

# ── Parse arguments ───────────────────────────────────────────────────────────
MODE="all"   # all | tool-only | tests | servers

for arg in "$@"; do
    case "$arg" in
        --tool-only) MODE="tool-only" ;;
        --tests)     MODE="tests"     ;;
        --servers)   MODE="servers"   ;;
        --help)
            echo "Usage: ./run.sh [--tool-only] [--tests] [--servers] [--help]"
            echo ""
            echo "  (no flag)      Run tool + tests, then start backend and frontend"
            echo "  --tool-only    Run Clang tool against tests/test_kernels.cpp only"
            echo "  --tests        Run automated test validation (validate_tests.py)"
            echo "  --servers      Start backend (port 4000) + frontend (port 3000)"
            exit 0
            ;;
    esac
done

# ── Resolve paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY="$SCRIPT_DIR/clang-tool/build/precision-demote"
TESTS_DIR="$SCRIPT_DIR/tests"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   PrecisionDemote — FP32 → FP16 Demotion Tool    ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Detect Windows (re-invoke in WSL for Clang parts) ────────────────────────
IS_WINDOWS=false
if [[ "$(uname -s)" == MINGW* ]] || [[ "$(uname -s)" == MSYS* ]] || [[ -n "${WINDIR:-}" ]]; then
    IS_WINDOWS=true
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Run the Clang tool
# ═══════════════════════════════════════════════════════════════════════════════

run_clang_tool() {
    hdr "Running Clang Tool"

    if $IS_WINDOWS; then
        # Running on Windows — invoke through WSL
        WSL_DISTRO="${WSL_DISTRO:-Ubuntu}"
        REPO_WIN="$(pwd -W 2>/dev/null || pwd)"
        WSL_REPO="/mnt/$(echo "$REPO_WIN" | sed 's|^\([A-Za-z]\):|\L\1|;s|\\|/|g')"
        WSL_BINARY="$WSL_REPO/clang-tool/build/precision-demote"
        WSL_TEST="$WSL_REPO/tests/test_kernels.cpp"
        WSL_OUT="$WSL_REPO/tests/analysis_result.json"

        log "Invoking via WSL ($WSL_DISTRO)..."

        if ! wsl -d "$WSL_DISTRO" -- test -x "$WSL_BINARY" 2>/dev/null; then
            err "Clang binary not found in WSL: $WSL_BINARY\n  Run ./build.sh first."
        fi

        wsl -d "$WSL_DISTRO" -- "$WSL_BINARY" \
            "$WSL_TEST" \
            "--output-json=$WSL_OUT" \
            -- -std=c++17

    else
        # Running inside Linux/WSL directly
        if [[ ! -x "$BINARY" ]]; then
            err "Clang binary not found: $BINARY\n  Run ./build.sh first."
        fi

        log "Binary: $BINARY"
        log "Input:  $TESTS_DIR/test_kernels.cpp"
        log "Output: $TESTS_DIR/analysis_result.json"
        echo ""

        "$BINARY" \
            "$TESTS_DIR/test_kernels.cpp" \
            "--output-json=$TESTS_DIR/analysis_result.json" \
            -- -std=c++17

        echo ""
        ok "Analysis complete. JSON written to tests/analysis_result.json"

        # Pretty-print summary
        if command -v python3 &>/dev/null && [[ -f "$TESTS_DIR/analysis_result.json" ]]; then
            echo ""
            python3 - <<'PYEOF'
import json, sys
try:
    with open("tests/analysis_result.json") as f:
        d = json.load(f)
    print("  Function Results:")
    for fn in d.get("functions", []):
        safe  = [n["name"] for n in fn["nodes"] if n["isSafe"]]
        kept  = [n["name"] for n in fn["nodes"] if not n["isSafe"]]
        print(f"  • {fn['name']}(): demoted={safe}, kept={kept}")
except Exception as e:
    print(f"  (Could not parse JSON: {e})")
PYEOF
        fi
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Run all individual test cases
# ═══════════════════════════════════════════════════════════════════════════════

run_individual_tests() {
    hdr "Running Individual Test Cases"

    TC_FILES=(
        "tests/tc_accumulator.cpp"
        "tests/tc_division.cpp"
        "tests/tc_depth.cpp"
        "tests/tc_simple.cpp"
        "tests/tc_fanin.cpp"
        "tests/tc_mixed.cpp"
        "tests/tc_double.cpp"
    )

    if $IS_WINDOWS; then
        WSL_DISTRO="${WSL_DISTRO:-Ubuntu}"
        REPO_WIN="$(pwd -W 2>/dev/null || pwd)"
        WSL_REPO="/mnt/$(echo "$REPO_WIN" | sed 's|^\([A-Za-z]\):|\L\1|;s|\\|/|g')"
        WSL_BINARY="$WSL_REPO/clang-tool/build/precision-demote"

        if ! wsl -d "$WSL_DISTRO" -- test -x "$WSL_BINARY" 2>/dev/null; then
            warn "Clang binary not available — skipping individual test runs"
            return
        fi

        for tc_rel in "${TC_FILES[@]}"; do
            WSL_TC="$WSL_REPO/$tc_rel"
            log "Running $tc_rel ..."
            wsl -d "$WSL_DISTRO" -- "$WSL_BINARY" \
                "$WSL_TC" --dry-run -- -std=c++17 2>&1 | grep "\[precision-demote\]" | sed "s/^/  /"
        done
    else
        if [[ ! -x "$BINARY" ]]; then
            warn "Binary not found — skipping individual test runs"
            return
        fi

        for tc_rel in "${TC_FILES[@]}"; do
            tc_abs="$SCRIPT_DIR/$tc_rel"
            if [[ -f "$tc_abs" ]]; then
                log "Running $tc_rel ..."
                "$BINARY" "$tc_abs" --dry-run -- -std=c++17 2>&1 \
                    | grep "\[precision-demote\]" | sed "s/^/  /" || true
            else
                warn "File not found: $tc_rel"
            fi
        done
    fi
    echo ""
    ok "Individual test cases complete"
}

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Automated validation
# ═══════════════════════════════════════════════════════════════════════════════

run_validation() {
    hdr "Automated Test Validation"

    VALIDATE_SCRIPT="$TESTS_DIR/validate_tests.py"

    if [[ ! -f "$VALIDATE_SCRIPT" ]]; then
        warn "Validation script not found: $VALIDATE_SCRIPT"
        return
    fi

    if ! command -v python3 &>/dev/null; then
        warn "python3 not found — skipping automated validation"
        return
    fi

    if $IS_WINDOWS; then
        WSL_DISTRO="${WSL_DISTRO:-Ubuntu}"
        REPO_WIN="$(pwd -W 2>/dev/null || pwd)"
        WSL_REPO="/mnt/$(echo "$REPO_WIN" | sed 's|^\([A-Za-z]\):|\L\1|;s|\\|/|g')"
        WSL_BINARY="$WSL_REPO/clang-tool/build/precision-demote"

        if wsl -d "$WSL_DISTRO" -- test -x "$WSL_BINARY" 2>/dev/null; then
            wsl -d "$WSL_DISTRO" -- python3 \
                "$WSL_REPO/tests/validate_tests.py" \
                "$WSL_BINARY" || true
        else
            warn "Clang binary not found in WSL — skipping validation"
        fi
    else
        if [[ -x "$BINARY" ]]; then
            python3 "$VALIDATE_SCRIPT" "$BINARY" || true
        else
            warn "Binary not found — skipping validation"
        fi
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Start servers
# ═══════════════════════════════════════════════════════════════════════════════

start_servers() {
    hdr "Starting Backend + Frontend Servers"

    # ── Backend ──────────────────────────────────────────────────────────────
    if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
        log "Installing backend dependencies..."
        (cd "$BACKEND_DIR" && npm install --silent)
        ok "Backend dependencies installed"
    fi

    log "Starting backend on http://localhost:4000 ..."
    (cd "$BACKEND_DIR" && npm run dev &)
    BACKEND_PID=$!
    sleep 2

    # ── Frontend ─────────────────────────────────────────────────────────────
    if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
        log "Installing frontend dependencies..."
        (cd "$FRONTEND_DIR" && npm install --silent)
        ok "Frontend dependencies installed"
    fi

    log "Starting frontend on http://localhost:3000 ..."
    (cd "$FRONTEND_DIR" && npm run dev &)
    FRONTEND_PID=$!
    sleep 3

    echo ""
    echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${GREEN}  Servers running!${NC}"
    echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════${NC}"
    echo -e "  Frontend: ${CYAN}http://localhost:3000${NC}"
    echo -e "  Backend:  ${CYAN}http://localhost:4000${NC}"
    echo -e "  Health:   ${CYAN}http://localhost:4000/api/health${NC}"
    echo ""
    echo -e "  ${YELLOW}Press Ctrl+C to stop all servers${NC}"
    echo ""

    # Trap Ctrl+C to cleanly kill child processes
    trap "echo ''; log 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; ok 'Done.'; exit 0" INT TERM

    # Wait for both
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
}

# ═══════════════════════════════════════════════════════════════════════════════
# DISPATCH
# ═══════════════════════════════════════════════════════════════════════════════

case "$MODE" in
    tool-only)
        run_clang_tool
        ;;
    tests)
        run_clang_tool
        run_individual_tests
        run_validation
        ;;
    servers)
        start_servers
        ;;
    all)
        run_clang_tool
        run_individual_tests
        run_validation
        start_servers
        ;;
esac
