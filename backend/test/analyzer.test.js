'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fallbackAnalysis,
  normalizeAnalysis,
  computeMetrics,
  computeBlockReason,
  expressionDepth,
} = require('../analyzer');

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
  assert.equal(m.bytesSaved, m.safeCount * 2);
  assert.ok(m.typeBlockedCount >= 1, 'double var counts as type-blocked');
  assert.ok(m.demotionRate >= 0 && m.demotionRate <= 100);
});
