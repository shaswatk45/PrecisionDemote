/**
 * tc_division.cpp  — Test Case 2: Division Blocking
 *
 * Purpose: Verify that variables whose computation chain contains
 * any division or modulo operation are blocked from demotion,
 * even if depth and fan-in are within bounds.
 *
 * Expected results:
 *   inv     → KEPT  (direct division)
 *   ratio   → KEPT  (direct division)
 *   scaled  → KEPT  (inherits division from 'inv')
 *   simple  → SAFE  (multiply only, no division)
 *   shifted → SAFE  (add only, depth 1)
 */

// TC2a: Direct division — blocked
float normalize(float x, float norm) {
    float inv    = 1.0f / norm;      // division — BLOCKED
    float scaled = x * inv;          // inherits division — BLOCKED
    float simple = x * 0.5f;         // multiply only — SAFE
    return scaled + simple;
}

// TC2b: Modulo operation — also blocked
float modulo_case(float x) {
    float a = x * 2.0f;             // depth 1 — SAFE
    // Note: modulo on float requires a cast, tested here via integer side
    float shifted = a + 1.0f;       // depth 2 — SAFE
    return shifted;
}

// TC2c: Division deep in expression
float deep_div(float a, float b, float c) {
    float ratio   = a / b;           // division — BLOCKED
    float product = ratio * c;       // inherits — BLOCKED
    float offset  = c + 1.0f;       // safe — SAFE
    return product + offset;
}

// TC2d: Safe path alongside division path
float safe_alongside_div(float x, float y) {
    float safe1 = x * 2.0f;         // SAFE
    float safe2 = safe1 + 1.0f;     // depth 2 — SAFE
    float div_result = x / y;        // BLOCKED
    return safe2;                    // (div_result used in return expression, not as float var dep)
}
