/**
 * tc_simple.cpp  — Test Case 4: Simple Safe Demotion (Positive Case)
 *
 * Purpose: Verify that straightforward, independent float computations
 * with depth ≤ 3, no division, no accumulation, and low fan-in
 * are ALL correctly demoted to __fp16.
 *
 * Expected results: ALL variables → SAFE (demoted to __fp16)
 */

// TC4a: Independent loads
float all_loads(float* a, float* b, float* c, int i) {
    float x = a[i];        // depth 0 — SAFE
    float y = b[i];        // depth 0 — SAFE
    float z = c[i];        // depth 0 — SAFE
    return x + y + z;
}

// TC4b: Simple arithmetic (depth ≤ 1)
float simple_math(float a, float b) {
    float sum  = a + b;    // depth 1 — SAFE
    float diff = a - b;    // depth 1 — SAFE
    float prod = a * b;    // depth 1 — SAFE
    return sum * diff + prod;
}

// TC4c: Two-level chain — still safe
float two_level(float x, float y, float z) {
    float step1 = x + y;       // depth 1 — SAFE
    float step2 = step1 * z;   // depth 2 — SAFE
    return step2;
}

// TC4d: Ternary operator (depth 0 leaf result)
float conditional_load(float a, float b, int cond) {
    float result = cond ? a : b;   // depth 0 — SAFE
    return result;
}

// TC4e: Three-level chain — at limit
float three_level(float a, float b, float c, float d) {
    float t1 = a + b;      // depth 1 — SAFE
    float t2 = t1 * c;     // depth 2 — SAFE
    float t3 = t2 - d;     // depth 3 — SAFE (exactly at limit)
    return t3;
}
