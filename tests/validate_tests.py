#!/usr/bin/env python3
"""
validate_tests.py — Automated Test Suite Validator
PrecisionDemote Project

Runs the precision-demote Clang tool against each test case and
checks the JSON output against expected heuristic outcomes.

Usage (from repo root, inside WSL):
    python3 tests/validate_tests.py <path-to-precision-demote-binary>

    # Example:
    python3 tests/validate_tests.py clang-tool/build/precision-demote

Exit code: 0 if all tests pass, 1 if any fail.
"""

import json
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

# ── ANSI colours ──────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ── Expected outcome spec ─────────────────────────────────────────────────────

@dataclass
class VarExpectation:
    """Expected classification of one float variable."""
    name:    str
    is_safe: bool           # True = should be demoted; False = should be kept
    reason:  str = ""       # Human-readable reason for the expected outcome
    rec:     str = ""       # Optional: expected recommendedType (__fp16/__bf16/float)


@dataclass
class FuncExpectation:
    """Expected analysis outcome for one function."""
    func_name: str
    variables: List[VarExpectation] = field(default_factory=list)


@dataclass
class TestCase:
    """One complete test case specification."""
    id:          str            # e.g. "TC1"
    file:        str            # relative path from repo root
    description: str
    functions:   List[FuncExpectation] = field(default_factory=list)
    # If None, no specific check on demotion count
    min_safe:    Optional[int]  = None
    max_safe:    Optional[int]  = None


# ── Test case definitions ─────────────────────────────────────────────────────

TEST_CASES: List[TestCase] = [

    # ── TC0: Primary test suite (test_kernels.cpp) ────────────────────────────
    TestCase(
        id="TC0", file="tests/test_kernels.cpp",
        description="Primary kernel suite — 6 functions, 18 float vars, 13 safe",
        min_safe=13, max_safe=13,
        functions=[
            FuncExpectation("dot_product", [
                VarExpectation("sum",  False, "accumulator (+=)"),
                VarExpectation("ai",   True,  "depth 0, no division"),
                VarExpectation("bi",   True,  "depth 0, no division"),
                VarExpectation("prod", True,  "depth 1, no division"),
            ]),
            FuncExpectation("relu", [
                VarExpectation("result", True,  "depth 1, ternary is safe"),
            ]),
            FuncExpectation("sigmoid_approx", [
                VarExpectation("half", True,  "depth 1, no division"),
                VarExpectation("inv",  False, "direct division"),
            ]),
            FuncExpectation("l2_norm_sq", [
                VarExpectation("acc", False, "accumulator (+=)"),
                VarExpectation("vi",  True,  "depth 0"),
                VarExpectation("vi2", True,  "depth 1"),
            ]),
            FuncExpectation("scale_bias", [
                VarExpectation("x",   True,  "depth 0"),
                VarExpectation("sx",  True,  "depth 1"),
                VarExpectation("res", True,  "depth 2"),
            ]),
            FuncExpectation("deep_chain", [
                VarExpectation("t1", True,  "depth 1"),
                VarExpectation("t2", True,  "depth 2"),
                VarExpectation("t3", True,  "depth 3 — at limit"),
                VarExpectation("t4", False, "depth 4 — exceeds limit"),
                VarExpectation("t5", False, "depth 5 — exceeds limit"),
            ]),
        ],
    ),

    # ── TC1: Accumulator detection ────────────────────────────────────────────
    TestCase(
        id="TC1", file="tests/tc_accumulator.cpp",
        description="Accumulator detection — += and *= must block demotion",
        functions=[
            FuncExpectation("sum_array", [
                VarExpectation("running_sum", False, "accumulates via +="),
                VarExpectation("temp",        True,  "simple load, depth 0"),
            ]),
            FuncExpectation("product_reduce", [
                VarExpectation("running_prod", False, "accumulates via *="),
                VarExpectation("base",         True,  "simple load, depth 0"),
            ]),
        ],
    ),

    # ── TC2: Division blocking ────────────────────────────────────────────────
    TestCase(
        id="TC2", file="tests/tc_division.cpp",
        description="Division blocking — direct and inherited division must block",
        functions=[
            FuncExpectation("normalize", [
                VarExpectation("inv",    False, "direct division 1.0f/norm"),
                VarExpectation("scaled", False, "inherits division from inv"),
                VarExpectation("simple", True,  "multiply only — safe"),
            ]),
            FuncExpectation("deep_div", [
                VarExpectation("ratio",   False, "direct division"),
                VarExpectation("product", False, "inherits division"),
                VarExpectation("offset",  True,  "independent, no division"),
            ]),
        ],
    ),

    # ── TC3: Depth limiting ───────────────────────────────────────────────────
    TestCase(
        id="TC3", file="tests/tc_depth.cpp",
        description="Arithmetic depth limit — depth > 3 must block demotion",
        functions=[
            FuncExpectation("linear_chain", [
                VarExpectation("d1", True,  "depth 1"),
                VarExpectation("d2", True,  "depth 2"),
                VarExpectation("d3", True,  "depth 3 — at limit"),
                VarExpectation("d4", False, "depth 4 — exceeds limit"),
                VarExpectation("d5", False, "depth 5 — exceeds limit"),
                VarExpectation("d6", False, "depth 6 — exceeds limit"),
            ]),
        ],
    ),

    # ── TC4: Simple safe demotion ─────────────────────────────────────────────
    TestCase(
        id="TC4", file="tests/tc_simple.cpp",
        description="Positive case — all simple float vars must be demoted",
        min_safe=10,
        functions=[
            FuncExpectation("simple_math", [
                VarExpectation("sum",  True, "depth 1"),
                VarExpectation("diff", True, "depth 1"),
                VarExpectation("prod", True, "depth 1"),
            ]),
            FuncExpectation("two_level", [
                VarExpectation("step1", True, "depth 1"),
                VarExpectation("step2", True, "depth 2"),
            ]),
            FuncExpectation("three_level", [
                VarExpectation("t1", True, "depth 1"),
                VarExpectation("t2", True, "depth 2"),
                VarExpectation("t3", True, "depth 3 — at limit"),
            ]),
        ],
    ),

    # ── TC5: Fan-in limiting ──────────────────────────────────────────────────
    TestCase(
        id="TC5", file="tests/tc_fanin.cpp",
        description="Fan-in limit — > 5 float var deps must block demotion",
        functions=[
            FuncExpectation("mid_fanin_case", [
                VarExpectation("v1",       True,  "no deps — SAFE"),
                VarExpectation("v2",       True,  "no deps — SAFE"),
                VarExpectation("v3",       True,  "no deps — SAFE"),
                VarExpectation("v4",       True,  "no deps — SAFE"),
                VarExpectation("v5",       True,  "no deps — SAFE"),
                VarExpectation("mid_fanin", True,  "exactly 5 deps — SAFE"),
            ]),
            FuncExpectation("high_fanin_case", [
                VarExpectation("high_fanin", False, "6 deps — exceeds maxFanIn"),
            ]),
        ],
    ),

    # ── TC6: Mixed realistic kernel ───────────────────────────────────────────
    TestCase(
        id="TC6", file="tests/tc_mixed.cpp",
        description="Realistic layer-norm kernel — mix of all rule types",
        functions=[
            FuncExpectation("layer_norm_forward", [
                VarExpectation("mean",    False, "accumulator"),
                VarExpectation("var",     False, "accumulator"),
                VarExpectation("inv_std", False, "direct division"),
            ]),
        ],
    ),

    # ── TC7: Double type exclusion ────────────────────────────────────────────
    TestCase(
        id="TC7", file="tests/tc_double.cpp",
        description="Double type — double vars must never be demoted",
        functions=[
            FuncExpectation("double_only", [
                VarExpectation("da",   False, "type is double — excluded"),
                VarExpectation("db",   False, "type is double — excluded"),
                VarExpectation("dsum", False, "type is double — excluded"),
            ]),
            FuncExpectation("mixed_types", [
                VarExpectation("fa1",   True,  "type is float — SAFE"),
                VarExpectation("fb1",   True,  "type is float — SAFE"),
                VarExpectation("fprod", True,  "type is float — SAFE"),
            ]),
        ],
    ),

    # ── TC8: FP16 range / overflow → BF16 recommendation (Rule 6) ─────────────
    TestCase(
        id="TC8", file="tests/tc_overflow.cpp",
        description="FP16 overflow (Rule 6) → recommend BF16 for out-of-range vars",
        functions=[
            FuncExpectation("overflow_cases", [
                VarExpectation("ok",     True,  "in range", rec="__fp16"),
                VarExpectation("big",    False, "70000 > FP16 max", rec="__bf16"),
                VarExpectation("scaled", False, "inherits overflow", rec="__bf16"),
                VarExpectation("small",  True,  "in range", rec="__fp16"),
            ]),
        ],
    ),
]


# ── Runner ────────────────────────────────────────────────────────────────────

def run_tool(binary: str, source_file: str, tmp_json: str) -> Optional[dict]:
    """Invoke precision-demote and return parsed JSON, or None on failure."""
    cmd = [binary, source_file, f"--output-json={tmp_json}", "--", "-std=c++17"]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=60
        )
        if not os.path.exists(tmp_json):
            print(f"  {RED}✗ Tool did not produce JSON output{RESET}")
            if result.stderr:
                print(f"  stderr: {result.stderr[:300]}")
            return None
        with open(tmp_json) as f:
            return json.load(f)
    except subprocess.TimeoutExpired:
        print(f"  {RED}✗ Tool timed out after 60s{RESET}")
        return None
    except FileNotFoundError:
        print(f"  {RED}✗ Binary not found: {binary}{RESET}")
        return None
    except json.JSONDecodeError as e:
        print(f"  {RED}✗ JSON parse error: {e}{RESET}")
        return None


def check_test(tc: TestCase, analysis: dict, repo_root: str) -> Tuple[int, int]:
    """
    Validate analysis JSON against expected outcomes.
    Returns (passed, total) counts.
    """
    passed = 0
    total  = 0

    # Index functions by name
    func_map: Dict[str, dict] = {
        f["name"]: f for f in analysis.get("functions", [])
    }

    # Check per-variable expectations
    for func_exp in tc.functions:
        fn_data = func_map.get(func_exp.func_name)
        if fn_data is None:
            print(f"    {YELLOW}⚠ Function '{func_exp.func_name}' not found in output{RESET}")
            continue

        node_map = {n["name"]: n for n in fn_data.get("nodes", [])}

        for var_exp in func_exp.variables:
            total += 1
            node = node_map.get(var_exp.name)
            if node is None:
                print(f"    {YELLOW}⚠ Variable '{var_exp.name}' not found "
                      f"in function '{func_exp.func_name}'{RESET}")
                continue

            actual_safe = node.get("isSafe", False)
            ok = (actual_safe == var_exp.is_safe)

            status = f"{GREEN}✓{RESET}" if ok else f"{RED}✗{RESET}"
            expected_str = "SAFE" if var_exp.is_safe else "KEPT"
            actual_str   = "SAFE" if actual_safe      else "KEPT"
            reason_str   = f"({var_exp.reason})" if var_exp.reason else ""

            if ok:
                passed += 1
                print(f"    {status} {func_exp.func_name}::{var_exp.name}: "
                      f"{expected_str} {reason_str}")
            else:
                print(f"    {status} {func_exp.func_name}::{var_exp.name}: "
                      f"expected {expected_str}, got {actual_str} {reason_str}")

            # Optional: verify the recommended narrow type (FP16 / BF16 / float)
            if var_exp.rec:
                total += 1
                actual_rec = node.get("recommendedType", "")
                rec_ok = (actual_rec == var_exp.rec)
                rstatus = f"{GREEN}✓{RESET}" if rec_ok else f"{RED}✗{RESET}"
                if rec_ok:
                    passed += 1
                    print(f"    {rstatus} {func_exp.func_name}::{var_exp.name}: "
                          f"recommends {actual_rec}")
                else:
                    print(f"    {rstatus} {func_exp.func_name}::{var_exp.name}: "
                          f"expected rec {var_exp.rec}, got {actual_rec}")

    # Check aggregate safe counts if specified
    all_nodes = [n for f in analysis.get("functions", []) for n in f.get("nodes", [])]
    total_safe = sum(1 for n in all_nodes if n.get("isSafe"))

    if tc.min_safe is not None or tc.max_safe is not None:
        total += 1
        lo = tc.min_safe if tc.min_safe is not None else 0
        hi = tc.max_safe if tc.max_safe is not None else 999
        ok = lo <= total_safe <= hi
        status = f"{GREEN}✓{RESET}" if ok else f"{RED}✗{RESET}"
        bound = f"[{lo}, {hi}]" if lo != hi else str(lo)
        if ok:
            passed += 1
            print(f"    {status} Total safe count: {total_safe} (expected {bound})")
        else:
            print(f"    {status} Total safe count: {total_safe} (expected {bound}) — MISMATCH")

    return passed, total


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(f"Usage: python3 tests/validate_tests.py <path-to-precision-demote>")
        sys.exit(1)

    binary    = os.path.abspath(sys.argv[1])
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    if not os.path.isfile(binary):
        print(f"{RED}Error: binary not found: {binary}{RESET}")
        sys.exit(1)

    print(f"\n{BOLD}{CYAN}╔══════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{CYAN}║   PrecisionDemote — Automated Test Suite          ║{RESET}")
    print(f"{BOLD}{CYAN}╚══════════════════════════════════════════════════╝{RESET}")
    print(f"  Binary:    {binary}")
    print(f"  Repo root: {repo_root}")
    print(f"  Test cases: {len(TEST_CASES)}\n")

    grand_passed = 0
    grand_total  = 0
    failed_tcs   = []

    with tempfile.TemporaryDirectory() as tmpdir:
        for tc in TEST_CASES:
            src_abs = os.path.join(repo_root, tc.file)
            if not os.path.isfile(src_abs):
                print(f"{YELLOW}[{tc.id}] SKIP — file not found: {tc.file}{RESET}\n")
                continue

            print(f"{BOLD}[{tc.id}] {tc.description}{RESET}")
            print(f"  File: {tc.file}")

            tmp_json = os.path.join(tmpdir, f"{tc.id}_out.json")
            analysis = run_tool(binary, src_abs, tmp_json)

            if analysis is None:
                print(f"  {RED}FAILED — tool did not produce output{RESET}\n")
                failed_tcs.append(tc.id)
                continue

            # Show quick summary
            funcs  = analysis.get("functions", [])
            n_vars = sum(len(f.get("nodes", [])) for f in funcs)
            n_safe = sum(1 for f in funcs for n in f.get("nodes", []) if n.get("isSafe"))
            print(f"  Functions: {len(funcs)}, Float vars: {n_vars}, Safe: {n_safe}")

            # Clean up tmp json
            if os.path.exists(tmp_json):
                os.remove(tmp_json)

            p, t = check_test(tc, analysis, repo_root)
            grand_passed += p
            grand_total  += t

            tc_ok = (p == t)
            result_str = f"{GREEN}PASSED{RESET}" if tc_ok else f"{RED}FAILED{RESET}"
            print(f"  Result: {result_str} ({p}/{t} checks)\n")
            if not tc_ok:
                failed_tcs.append(tc.id)

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}SUMMARY{RESET}")
    print(f"  Total checks: {grand_total}")
    print(f"  Passed:       {grand_passed}")
    print(f"  Failed:       {grand_total - grand_passed}")

    if failed_tcs:
        print(f"  Failed TCs:   {', '.join(failed_tcs)}")
        print(f"\n{RED}{BOLD}✗ Some tests FAILED{RESET}\n")
        sys.exit(1)
    else:
        print(f"\n{GREEN}{BOLD}✓ All tests PASSED{RESET}\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
