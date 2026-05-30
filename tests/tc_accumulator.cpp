/**
 * tc_accumulator.cpp  — Test Case 1: Accumulator Detection
 *
 * Purpose: Verify that variables used with compound-assignment operators
 * (+=, -=, *=, /=) are NEVER demoted, even if all other rules pass.
 *
 * Expected results:
 *   running_sum  → KEPT  (accumulates via +=)
 *   running_prod → KEPT  (accumulates via *=)
 *   temp         → SAFE  (simple load, no accumulation)
 *   base         → SAFE  (depth 0)
 */

// TC1a: Classic loop accumulator
float sum_array(float* arr, int n) {
    float running_sum = 0.0f;   // accumulator — KEPT
    float temp;
    for (int i = 0; i < n; i++) {
        temp = arr[i];          // depth 0 — SAFE
        running_sum += temp;
    }
    return running_sum;
}

// TC1b: Multiplicative accumulator
float product_reduce(float* arr, int n) {
    float running_prod = 1.0f;  // accumulator (*=) — KEPT
    float base;
    for (int i = 0; i < n; i++) {
        base = arr[i];          // depth 0 — SAFE
        running_prod *= base;
    }
    return running_prod;
}

// TC1c: Mixed — some accumulate, some do not
float mixed_accum(float* a, float* b, int n) {
    float total = 0.0f;         // accumulator — KEPT
    float scale = 2.0f;         // depth 0 — SAFE (no accumulation)
    for (int i = 0; i < n; i++) {
        float x = a[i];         // depth 0 — SAFE
        float y = b[i] * scale; // depth 1 — SAFE
        total += x + y;
    }
    return total;
}
