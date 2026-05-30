/**
 * tc_fanin.cpp  — Test Case 5: Fan-In Limit
 *
 * Purpose: Verify that variables with more than maxFanIn (default: 5)
 * float variable dependencies are blocked from demotion.
 *
 * Expected results (default maxFanIn=5):
 *   low_fanin  → SAFE  (2 deps)
 *   mid_fanin  → SAFE  (5 deps — at limit)
 *   high_fanin → KEPT  (6 deps — exceeds limit)
 */

// TC5a: Low fan-in — safe
float low_fanin_case(float a, float b) {
    float low_fanin = a + b;    // 0 float var deps (a,b are params, not local float vars)
    return low_fanin;
}

// TC5b: Building up to the fan-in limit
float mid_fanin_case(float* arr) {
    float v1 = arr[0];                          // dep count: 0 — SAFE
    float v2 = arr[1];                          // dep count: 0 — SAFE
    float v3 = arr[2];                          // dep count: 0 — SAFE
    float v4 = arr[3];                          // dep count: 0 — SAFE
    float v5 = arr[4];                          // dep count: 0 — SAFE
    float mid_fanin = v1 + v2 + v3 + v4 + v5;  // dep count: 5 — SAFE (at limit)
    return mid_fanin;
}

// TC5c: Exceeding fan-in limit
float high_fanin_case(float* arr) {
    float a1 = arr[0];   // SAFE
    float a2 = arr[1];   // SAFE
    float a3 = arr[2];   // SAFE
    float a4 = arr[3];   // SAFE
    float a5 = arr[4];   // SAFE
    float a6 = arr[5];   // SAFE
    // 6 float variable dependencies — exceeds maxFanIn=5 → BLOCKED
    float high_fanin = a1 + a2 + a3 + a4 + a5 + a6;
    return high_fanin;
}

// TC5d: Mix of safe and blocked by fan-in
float mixed_fanin(float* data, int n) {
    float x = data[0];     // SAFE
    float y = data[1];     // SAFE
    float z = data[2];     // SAFE
    float pair = x + y;    // dep count: 2 — SAFE
    return pair + z;
}
