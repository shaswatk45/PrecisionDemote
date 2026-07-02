'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fallbackAnalysis,
  normalizeAnalysis,
  computeMetrics,
  computeBlockReason,
  expressionDepth,
  recommendType,
  estimateErrorBound,
  safetyScore,
  toSarif,
  FP16_UNIT_RND,
  BF16_UNIT_RND,
} = require('../analyzer');

const OVERFLOW_SAMPLE = `
float scale_kernel(float* x, int n) {
    float gain   = 70000.0f;
    float scaled = gain + x[0];
    float small  = x[0] * 0.5f;
    return scaled + small;
}
`;

const SAMPLE = `
float dot_product(float* a, float* b, int n) {
    float sum = 0.0f;
    for (int i = 0; i < n; i++) {
        float ai = a[i];
        float bi = b[i];
        float prod = ai * bi;
        sum += prod;
    }
    return sum;
}

float sigmoid_approx(float x) {
    float half = x * 0.5f;
    float inv = 1.0f / (1.0f + half);
    return inv;
}

double accum_double(double* v, int n) {
    double dsum = 0.0;
    return dsum;
}
`;

function nodeMap(fn) {
  return Object.fromEntries(fn.nodes.map((n) => [n.name, n]));
}

test('fallbackAnalysis flags accumulators, division, and safe vars', () => {
  const a = fallbackAnalysis(SAMPLE, 'sample.cpp');
  const dot = a.functions.find((f) => f.name === 'dot_product');
  const m = nodeMap(dot);

  assert.equal(m.sum.isSafe, false, 'sum is an accumulator');
  assert.equal(m.sum.blockReason, 'accumulator');
  assert.equal(m.ai.isSafe, true);
  assert.equal(m.ai.blockReason, '');
  assert.equal(m.prod.isSafe, true);
});

test('division blocks demotion with a division reason', () => {
  const a = fallbackAnalysis(SAMPLE, 'sample.cpp');
  const sig = a.functions.find((f) => f.name === 'sigmoid_approx');
  const m = nodeMap(sig);
  assert.equal(m.half.isSafe, true);
  assert.equal(m.inv.isSafe, false);
  assert.equal(m.inv.blockReason, 'division');
});

test('double locals are surfaced as type-blocked nodes', () => {
  const a = fallbackAnalysis(SAMPLE, 'sample.cpp');
  const fn = a.functions.find((f) => f.name === 'accum_double');
  const m = nodeMap(fn);
  assert.ok(m.dsum, 'double var should appear in output');
  assert.equal(m.dsum.type, 'double');
  assert.equal(m.dsum.isSafe, false);
  assert.equal(m.dsum.blockReason, 'type');
});

test('rewritten source demotes only safe float decls', () => {
  const a = fallbackAnalysis(SAMPLE, 'sample.cpp');
  assert.match(a.rewrittenSource, /__fp16 ai/);
  assert.match(a.rewrittenSource, /__fp16 prod/);
  assert.match(a.rewrittenSource, /float sum/); // accumulator kept
  assert.match(a.rewrittenSource, /float inv/); // division kept
});

test('thresholds are configurable', () => {
  const strict = fallbackAnalysis(SAMPLE, 'sample.cpp', { maxFanIn: 1 });
  const dot = strict.functions.find((f) => f.name === 'dot_product');
  const m = nodeMap(dot);
  // prod depends on ai + bi (fan-in 2) -> exceeds maxFanIn 1
  assert.equal(m.prod.isSafe, false);
  assert.equal(m.prod.blockReason, 'fan-in');
});

test('computeBlockReason follows the documented priority order', () => {
  // division reported before depth
  assert.equal(
    computeBlockReason({ type: 'float', isAccumulator: false, hasDivision: true, depth: 9, dependencyCount: 0 }, { maxDepth: 3, maxFanIn: 5 }),
    'division'
  );
  // accumulator reported before division
  assert.equal(
    computeBlockReason({ type: 'float', isAccumulator: true, hasDivision: true, depth: 0, dependencyCount: 0 }, { maxDepth: 3, maxFanIn: 5 }),
    'accumulator'
  );
});

test('expressionDepth counts arithmetic operators', () => {
  assert.equal(expressionDepth('a * b'), 1);
  assert.equal(expressionDepth('a + b + c'), 2);
  assert.equal(expressionDepth('x'), 0);
});

test('normalizeAnalysis repairs the legacy safeTodemote typo', () => {
  const legacy = {
    functions: [
      { name: 'f', safeTodemote: 2, nodes: [{ name: 'x', isSafe: true }, { name: 'y', isSafe: false, hasDivision: true, type: 'float', depth: 0, dependencyCount: 0 }] },
    ],
  };
  const fixed = normalizeAnalysis(legacy);
  assert.equal(fixed.functions[0].safeToDemote, 2);
  assert.equal(fixed.functions[0].safeTodemote, undefined);
  assert.equal(fixed.functions[0].nodes[1].blockReason, 'division');
});

test('computeMetrics tallies safe/unsafe and byte savings', () => {
  const a = fallbackAnalysis(SAMPLE, 'sample.cpp');
  const m = computeMetrics(a);
  assert.equal(m.safeCount + m.unsafeCount, m.totalFloatVars);
  assert.equal(m.bytesSaved, m.narrowedCount * 2);
  assert.ok(m.typeBlockedCount >= 1, 'double var counts as type-blocked');
  assert.ok(m.demotionRate >= 0 && m.demotionRate <= 100);
  assert.ok(m.avgSafetyScore >= 0 && m.avgSafetyScore <= 100);
  assert.ok(m.estimatedSpeedup >= 1);
});

// ── v3: numerical model ──────────────────────────────────────────────────────

test('overflow (>FP16 max) is flagged and recommends BF16', () => {
  const a = fallbackAnalysis(OVERFLOW_SAMPLE, 'ovf.cpp');
  const fn = a.functions[0];
  const m = Object.fromEntries(fn.nodes.map((n) => [n.name, n]));
  assert.equal(m.gain.overflowRisk, true);
  assert.equal(m.gain.blockReason, 'overflow');
  assert.equal(m.gain.recommendedType, '__bf16');
  assert.equal(m.scaled.recommendedType, '__bf16', 'inherits out-of-range magnitude');
  assert.equal(m.small.recommendedType, '__fp16');
});

test('mixed-precision rewrite emits both __fp16 and __bf16', () => {
  const a = fallbackAnalysis(OVERFLOW_SAMPLE, 'ovf.cpp');
  assert.match(a.rewrittenSource, /__bf16 gain/);
  assert.match(a.rewrittenSource, /__fp16 small/);
});

test('error bound uses the correct unit roundoff per target', () => {
  // depth 0 -> (0+1) * u
  assert.equal(estimateErrorBound(0, '__fp16'), FP16_UNIT_RND);
  assert.equal(estimateErrorBound(0, '__bf16'), BF16_UNIT_RND);
  assert.equal(estimateErrorBound(2, '__fp16'), 3 * FP16_UNIT_RND);
  assert.equal(estimateErrorBound(5, 'float'), 0);
});

test('safety score is graded, not binary', () => {
  const th = { maxDepth: 3, maxFanIn: 5 };
  const clean = safetyScore({ type: 'float', isAccumulator: false, hasDivision: false, overflowRisk: false, depth: 0, dependencyCount: 0 }, th);
  const deep = safetyScore({ type: 'float', isAccumulator: false, hasDivision: false, overflowRisk: false, depth: 2, dependencyCount: 1 }, th);
  const acc = safetyScore({ type: 'float', isAccumulator: true, hasDivision: false, overflowRisk: false, depth: 0, dependencyCount: 0 }, th);
  assert.equal(clean, 100);
  assert.ok(deep < clean && deep > acc, 'graded gradient between clean and blocked');
  assert.equal(recommendType(''), '__fp16');
  assert.equal(recommendType('overflow'), '__bf16');
  assert.equal(recommendType('division'), 'float');
});

test('toSarif produces a valid 2.1.0 log with per-variable results', () => {
  const a = fallbackAnalysis(OVERFLOW_SAMPLE, 'ovf.cpp');
  const sarif = toSarif(a, 'ovf.cpp');
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].tool.driver.name, 'PrecisionDemote');
  const results = sarif.runs[0].results;
  assert.ok(results.length >= 3);
  assert.ok(results.every((r) => r.ruleId && r.locations[0].physicalLocation.region.startLine >= 1));
  assert.ok(results.some((r) => r.ruleId === 'PD-BF16'));
});
