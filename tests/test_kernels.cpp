/**
 * test_kernels.cpp
 * Sample numerical kernels for testing the Precision-Aware Type Demotion Tool.
 *
 * When analyzed:
 *  - ai, bi, prod          → demoted to __fp16  (depth ≤ 1, no division)
 *  - sum                   → kept at float      (accumulation, depth grows)
 *  - result (relu)         → demoted to __fp16  (depth 1, no division)
 *  - inv (sigmoid)         → kept at float      (has division)
 */
#include <cstddef>

// ── 1. Dot product ────────────────────────────────────────────────────────────
float dot_product(float* a, float* b, int n) {
    float sum = 0.0f;                  // accumulates — kept
    for (int i = 0; i < n; i++) {
        float ai   = a[i];             // depth 0 — SAFE
        float bi   = b[i];             // depth 0 — SAFE
        float prod = ai * bi;          // depth 1 — SAFE
        sum += prod;
    }
    return sum;
}

// ── 2. ReLU activation ────────────────────────────────────────────────────────
float relu(float x) {
    float result = x > 0.0f ? x : 0.0f;   // depth 1 — SAFE
    return result;
}

// ── 3. Sigmoid approximation (contains division — blocked) ───────────────────
float sigmoid_approx(float x) {
    float half  = x * 0.5f;           // depth 1 — SAFE
    float inv   = 1.0f / (1.0f + half); // division — BLOCKED
    return inv;
}

// ── 4. L2 norm squared ───────────────────────────────────────────────────────
float l2_norm_sq(float* v, int n) {
    float acc = 0.0f;                  // accumulates — kept
    for (int i = 0; i < n; i++) {
        float vi  = v[i];              // depth 0 — SAFE
        float vi2 = vi * vi;           // depth 1 — SAFE
        acc += vi2;
    }
    return acc;
}

// ── 5. Element-wise scale + bias ─────────────────────────────────────────────
void scale_bias(float* out, const float* in, float scale, float bias, int n) {
    for (int i = 0; i < n; i++) {
        float x   = in[i];             // depth 0 — SAFE
        float sx  = x * scale;         // depth 1 — SAFE
        float res = sx + bias;         // depth 2 — SAFE
        out[i]    = res;
    }
}

// ── 6. Deep chain (should NOT be demoted) ────────────────────────────────────
float deep_chain(float a, float b, float c, float d) {
    float t1 = a + b;      // depth 1 — SAFE
    float t2 = t1 * c;     // depth 2 — SAFE
    float t3 = t2 - d;     // depth 3 — SAFE (borderline)
    float t4 = t3 * t3;    // depth 4 — BLOCKED (depth > 3)
    float t5 = t4 + 1.0f;  // depth 5 — BLOCKED
    return t5;
}
