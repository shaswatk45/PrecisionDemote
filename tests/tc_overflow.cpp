/**
 * tc_overflow.cpp — Test Case 8: FP16 range / overflow analysis (Rule 6)
 *
 * FP16's largest finite value is 65504. A float whose known constant magnitude
 * exceeds that would overflow when narrowed to __fp16 — but BF16 shares FP32's
 * exponent range, so it is the correct narrow target when *range* (not
 * precision) is the only problem.
 *
 * Expected (default thresholds):
 *   ok      → SAFE, __fp16   (in range, shallow)
 *   big     → KEPT, __bf16   (70000 > 65504 → FP16 overflow, precision ok)
 *   scaled  → KEPT, __bf16   (inherits the out-of-range magnitude from big)
 *   small   → SAFE, __fp16
 */

float overflow_cases() {
    float ok     = 1.5f;        // in range           → __fp16
    float big    = 70000.0f;    // > 65504 → overflow  → __bf16
    float scaled = big + 1.0f;  // inherits overflow   → __bf16
    float small  = 0.25f;       // in range            → __fp16
    return ok + big + scaled + small;
}
