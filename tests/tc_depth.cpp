/**
 * tc_depth.cpp  — Test Case 3: Arithmetic Depth Limiting
 *
 * Purpose: Verify that variables with transitive arithmetic depth
 * exceeding maxDepth (default: 3) are blocked from demotion.
 *
 * Expected results (default maxDepth=3):
 *   d1 → SAFE  (depth 1)
 *   d2 → SAFE  (depth 2)
 *   d3 → SAFE  (depth 3 — at limit)
 *   d4 → KEPT  (depth 4 — exceeds limit)
 *   d5 → KEPT  (depth 5 — exceeds limit)
 *   d6 → KEPT  (depth 6 — exceeds limit)
 */

// TC3a: Linear chain — depth increases step by step
float linear_chain(float a, float b, float c, float d, float e, float f) {
    float d1 = a + b;         // depth 1 — SAFE
    float d2 = d1 * c;        // depth 2 — SAFE
    float d3 = d2 - d;        // depth 3 — SAFE (at limit)
    float d4 = d3 + e;        // depth 4 — BLOCKED
    float d5 = d4 * f;        // depth 5 — BLOCKED
    float d6 = d5 - 1.0f;    // depth 6 — BLOCKED
    return d6;
}

// TC3b: Depth from nested expression
float nested_expr(float x) {
    // Local expression depth (not transitive) = 3 ops in one statement
    float r = (x + 1.0f) * (x - 1.0f) + x;  // depth 3 — SAFE (borderline)
    return r;
}

// TC3c: Branching depth — max path determines depth
float branching(float a, float b, float c) {
    float left  = a + b;       // depth 1 — SAFE
    float right = a * b * c;   // depth 2 — SAFE
    float combined = left + right;  // depth 2 — SAFE (max of branches + 1)
    return combined;
}

// TC3d: Call expression adds depth-1
float with_call(float x) {
    // Treating function call as depth-1 (as per tool design)
    float a = x * 2.0f;         // depth 1 — SAFE
    float b = a + 1.0f;         // depth 2 — SAFE
    float c = b * 0.5f + a;     // depth 3 — SAFE
    return c;
}
