/**
 * tc_mixed.cpp  — Test Case 6: Mixed Safe/Unsafe (Realistic Kernel)
 *
 * Purpose: A realistic ML-style kernel that exercises multiple rules
 * simultaneously. Tests that the tool correctly distinguishes safe
 * from unsafe variables within the same function.
 *
 * This simulates a layer normalization forward pass.
 *
 * Expected results:
 *   mean  → KEPT  (accumulator)
 *   var   → KEPT  (accumulator)
 *   xi    → SAFE  (load, depth 0)
 *   diff  → SAFE  (depth 1)
 *   sq    → SAFE  (depth 2)
 *   inv_std → KEPT (has division)
 *   norm  → KEPT  (inherits division from inv_std)
 *   out   → KEPT  (inherits division)
 *
 * Demotion rate: ~3/8 = 37.5%
 */
#include <cstddef>

void layer_norm_forward(
    float* output, const float* input, int n,
    float gamma, float beta, float eps)
{
    // Phase 1: Compute mean (accumulator — KEPT)
    float mean = 0.0f;
    for (int i = 0; i < n; i++) {
        float xi = input[i];       // depth 0 — SAFE
        mean += xi;
    }
    // mean /= n; (not modeled as float var)

    // Phase 2: Compute variance (accumulator — KEPT)
    float var = 0.0f;
    for (int i = 0; i < n; i++) {
        float xi   = input[i];     // depth 0 — SAFE
        float diff = xi - mean;    // depth 1 — SAFE
        float sq   = diff * diff;  // depth 2 — SAFE
        var += sq;
    }

    // Phase 3: Normalize (division — BLOCKED chain)
    float inv_std = 1.0f / (var + eps);  // BLOCKED: direct division
    for (int i = 0; i < n; i++) {
        float xi   = input[i];             // depth 0 — SAFE
        float norm = (xi - mean) * inv_std; // BLOCKED: inherits division
        float out  = gamma * norm + beta;   // BLOCKED: inherits division
        output[i]  = out;
    }
}
