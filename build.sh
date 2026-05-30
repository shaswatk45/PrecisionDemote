#!/usr/bin/env bash
# =============================================================================
# build.sh — PrecisionDemote Build Script
#
# Builds the Clang LibTooling binary inside WSL Ubuntu.
# Run from the repo root on Windows (Git Bash, WSL, or PowerShell via wsl.exe).
#
# Usage:
#   ./build.sh             # standard Release build
#   ./build.sh --clean     # wipe build dir first
#   ./build.sh --debug     # Debug build (slower, adds -g)
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[build]${NC} $*"; }
ok()   { echo -e "${GREEN}[build] ✓${NC} $*"; }
warn() { echo -e "${YELLOW}[build] ⚠${NC} $*"; }
err()  { echo -e "${RED}[build] ✗${NC} $*"; exit 1; }

# ── Parse arguments ───────────────────────────────────────────────────────────
CLEAN=false
BUILD_TYPE="Release"

for arg in "$@"; do
    case "$arg" in
        --clean) CLEAN=true ;;
        --debug) BUILD_TYPE="Debug" ;;
        --help)
            echo "Usage: ./build.sh [--clean] [--debug] [--help]"
            echo "  --clean   Wipe the build directory before building"
            echo "  --debug   Build with debug symbols"
            exit 0
            ;;
    esac
done

# ── Resolve paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL_DIR="$SCRIPT_DIR/clang-tool"
BUILD_DIR="$TOOL_DIR/build"
BINARY="$BUILD_DIR/precision-demote"

log "PrecisionDemote Build Script"
log "Script dir: $SCRIPT_DIR"
log "Build type: $BUILD_TYPE"

# ── Detect environment ────────────────────────────────────────────────────────
# If running on Windows via a non-WSL shell, re-invoke via WSL
if [[ "$(uname -s)" == MINGW* ]] || [[ "$(uname -s)" == MSYS* ]] || [[ -n "${WINDIR:-}" ]]; then
    log "Detected Windows shell — delegating to WSL..."
    WSL_DISTRO="${WSL_DISTRO:-Ubuntu}"
    REPO_WIN="$(pwd -W 2>/dev/null || pwd)"
    WSL_REPO="/mnt/$(echo "$REPO_WIN" | sed 's|^\([A-Za-z]\):|\L\1|;s|\\|/|g')"
    wsl -d "$WSL_DISTRO" -- bash "${WSL_REPO}/build.sh" "$@"
    exit $?
fi

# ── Check prerequisites ───────────────────────────────────────────────────────
log "Checking prerequisites..."

check_cmd() {
    if ! command -v "$1" &>/dev/null; then
        err "Required tool not found: $1\n  Install with: $2"
    fi
    ok "Found: $1 ($(command -v "$1"))"
}

check_cmd cmake "sudo apt install cmake"
check_cmd make  "sudo apt install build-essential"

# Check LLVM 18
LLVM_DIR="/usr/lib/llvm-18/lib/cmake/llvm"
CLANG_DIR="/usr/lib/llvm-18/lib/cmake/clang"

if [[ ! -d "$LLVM_DIR" ]]; then
    warn "LLVM 18 cmake config not found at $LLVM_DIR"
    warn "Install with:"
    warn "  sudo apt-get install -y llvm-18 clang-18 libclang-18-dev llvm-18-dev"
    err "LLVM 18 is required"
fi
ok "Found LLVM 18 at $LLVM_DIR"

if [[ ! -d "$CLANG_DIR" ]]; then
    err "Clang 18 cmake config not found at $CLANG_DIR"
fi
ok "Found Clang 18 at $CLANG_DIR"

# ── Clean if requested ────────────────────────────────────────────────────────
if $CLEAN && [[ -d "$BUILD_DIR" ]]; then
    log "Cleaning build directory..."
    rm -rf "$BUILD_DIR"
    ok "Build directory removed"
fi

# ── Configure ─────────────────────────────────────────────────────────────────
log "Configuring with CMake..."
mkdir -p "$BUILD_DIR"

cmake -S "$TOOL_DIR" -B "$BUILD_DIR" \
    -DLLVM_DIR="$LLVM_DIR" \
    -DClang_DIR="$CLANG_DIR" \
    -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
    -DCMAKE_EXPORT_COMPILE_COMMANDS=ON \
    2>&1 | sed "s/^/  /"

# ── Build ─────────────────────────────────────────────────────────────────────
NPROC=$(nproc 2>/dev/null || echo 4)
log "Building with $NPROC parallel jobs..."

cmake --build "$BUILD_DIR" -- -j"$NPROC" 2>&1 | sed "s/^/  /"

# ── Verify ────────────────────────────────────────────────────────────────────
if [[ ! -x "$BINARY" ]]; then
    err "Build succeeded but binary not found: $BINARY"
fi

ok "Binary built: $BINARY"
echo ""

# ── Quick smoke test ──────────────────────────────────────────────────────────
TEST_FILE="$SCRIPT_DIR/tests/test_kernels.cpp"
SMOKE_JSON="$BUILD_DIR/smoke_test.json"

if [[ -f "$TEST_FILE" ]]; then
    log "Running smoke test against tests/test_kernels.cpp..."
    "$BINARY" "$TEST_FILE" \
        --output-json="$SMOKE_JSON" \
        --dry-run \
        -- -std=c++17 2>&1 | sed "s/^/  /"

    if [[ -f "$SMOKE_JSON" ]]; then
        ok "Smoke test passed — JSON output produced"
        rm -f "$SMOKE_JSON"
    else
        warn "Smoke test did not produce JSON output (check above for errors)"
    fi
else
    warn "Test file not found, skipping smoke test: $TEST_FILE"
fi

echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Build complete!${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo -e "  Binary: ${CYAN}$BINARY${NC}"
echo ""
echo -e "  Run the full tool:"
echo -e "  ${CYAN}$BINARY tests/test_kernels.cpp --output-json result.json -- -std=c++17${NC}"
echo ""
echo -e "  Run tests:"
echo -e "  ${CYAN}python3 tests/validate_tests.py $BINARY${NC}"
echo ""
