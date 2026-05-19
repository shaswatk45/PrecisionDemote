/**
 * expected_output.cpp
 * What the tool SHOULD produce after analyzing test_kernels.cpp.
 * Variables marked SAFE are rewritten to __fp16.
 */
#include <cstddef>

// ── 1. Dot product ────────────────────────────────────────────────────────────
float dot_product(float* a, float* b, int n) {
    float sum = 0.0f;                  // kept — accumulates
    for (int i = 0; i < n; i++) {
        __fp16 ai   = a[i];            // DEMOTED — depth 0
        __fp16 bi   = b[i];            // DEMOTED — depth 0
        __fp16 prod = ai * bi;         // DEMOTED — depth 1
        sum += prod;
    }
    return sum;
}

// ── 2. ReLU activation ────────────────────────────────────────────────────────
float relu(float x) {
    __fp16 result = x > 0.0f ? x : 0.0f;  // DEMOTED — depth 1
    return result;
}

// ── 3. Sigmoid approximation ──────────────────────────────────────────────────
float sigmoid_approx(float x) {
    __fp16 half  = x * 0.5f;          // DEMOTED — depth 1
    float  inv   = 1.0f / (1.0f + half); // KEPT — has division
    return inv;
}

// ── 4. L2 norm squared ───────────────────────────────────────────────────────
float l2_norm_sq(float* v, int n) {
    float acc = 0.0f;                  // kept — accumulates
    for (int i = 0; i < n; i++) {
        __fp16 vi  = v[i];             // DEMOTED
        __fp16 vi2 = vi * vi;          // DEMOTED
        acc += vi2;
    }
    return acc;
}

// ── 5. Element-wise scale + bias ─────────────────────────────────────────────
void scale_bias(float* out, const float* in, float scale, float bias, int n) {
    for (int i = 0; i < n; i++) {
        __fp16 x   = in[i];            // DEMOTED
        __fp16 sx  = x * scale;        // DEMOTED
        __fp16 res = sx + bias;        // DEMOTED
        out[i]     = res;
    }
}

// ── 6. Deep chain ────────────────────────────────────────────────────────────
float deep_chain(float a, float b, float c, float d) {
    __fp16 t1 = a + b;     // DEMOTED — depth 1
    __fp16 t2 = t1 * c;    // DEMOTED — depth 2
    __fp16 t3 = t2 - d;    // DEMOTED — depth 3 (at limit)
    float  t4 = t3 * t3;   // KEPT — depth 4 > 3
    float  t5 = t4 + 1.0f; // KEPT — depth 5 > 3
    return t5;
}
