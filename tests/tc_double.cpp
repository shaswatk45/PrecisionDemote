/**
 * tc_double.cpp  — Test Case 7: Double Precision (Negative Case)
 *
 * Purpose: Verify that `double` variables are NEVER demoted.
 * The tool only processes `float` (FP32) → `__fp16`.
 * All `double` variables must pass through unchanged.
 *
 * Expected results:
 *   da, db, dsum  → KEPT  (type is double, not float)
 *   fa, fb        → SAFE  (type is float — demoted)
 *   fprod         → SAFE  (type is float — demoted)
 */

// TC7a: Pure double function — nothing should be demoted
double double_only(double* arr, int n) {
    double da  = arr[0];      // type: double — KEPT
    double db  = arr[1];      // type: double — KEPT
    double dsum = da + db;    // type: double — KEPT
    return dsum;
}

// TC7b: Mixed double and float in same function
float mixed_types(double* da, float* fa, int i) {
    double d1   = da[i];      // type: double — KEPT
    double d2   = d1 * 2.0;   // type: double — KEPT
    float  fa1  = fa[i];      // type: float  — SAFE
    float  fb1  = fa[i+1];    // type: float  — SAFE
    float  fprod = fa1 * fb1; // type: float  — SAFE
    return fprod;
}

// TC7c: Long double — also not demoted
long double long_double_case(long double x) {
    long double ld = x * 2.0L;   // type: long double — KEPT
    return ld;
}
