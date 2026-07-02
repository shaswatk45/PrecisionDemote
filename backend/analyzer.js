'use strict';

/**
 * analyzer.js — Pure, dependency-free precision-demotion analysis.
 *
 * This is the JavaScript *fallback* engine used when the real Clang
 * LibTooling binary is not reachable (e.g. no WSL / LLVM on the host). It is a
 * best-effort, regex-driven approximation of the AST analysis performed by
 * `clang-tool/src/main.cpp` and deliberately mirrors that tool's JSON schema:
 *
 *   - the 5 safety heuristics (type, accumulator, division, depth, fan-in)
 *   - a `blockReason` on every node (single source of truth for the UI)
 *   - `double` locals surfaced as type-blocked nodes (never demoted)
 *
 * Everything here is a pure function with no I/O, so it can be unit-tested in
 * isolation with `node --test`.
 */

const DEFAULT_THRESHOLDS = Object.freeze({ maxDepth: 3, maxFanIn: 5 });

// IEEE-754 constants for the numerical model (mirrors clang-tool/src/main.cpp).
const FP16_MAX = 65504.0;
const FP16_UNIT_RND = 4.8828125e-4; // 2^-11
const BF16_UNIT_RND = 3.90625e-3; // 2^-8

/** Largest absolute numeric-literal magnitude in an expression string. */
function maxLiteralMagnitude(expr) {
  if (!expr) return -1;
  const lits = expr.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  let m = -1;
  for (const l of lits) {
    const v = Math.abs(parseFloat(l));
    if (Number.isFinite(v)) m = Math.max(m, v);
  }
  return m;
}

/** Narrowest numerically-appropriate type given the block reason. */
function recommendType(blockReason) {
  if (blockReason === '') return '__fp16';
  if (blockReason === 'overflow') return '__bf16';
  return 'float';
}

/** First-order error-propagation bound for a demotion to `target`. */
function estimateErrorBound(depth, target) {
  if (target === 'float') return 0;
  const u = target === '__bf16' ? BF16_UNIT_RND : FP16_UNIT_RND;
  return (depth + 1) * u;
}

/** Graded 0-100 demotion-safety confidence (see main.cpp for the model). */
function safetyScore(node, th) {
  if (node.type !== 'float') return 0;
  let s = 100;
  if (node.isAccumulator) s -= 55;
  if (node.hasDivision) s -= 60;
  if (node.overflowRisk) s -= 45;
  s -= node.depth > th.maxDepth ? 40 : node.depth * 8;
  s -= node.dependencyCount > th.maxFanIn ? 30 : node.dependencyCount * 4;
  return Math.max(0, Math.min(100, Math.round(s)));
}

function stripComments(sourceCode) {
  return sourceCode
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function splitFunctions(sourceCode, filename) {
  const code = stripComments(sourceCode);
  const headerRe = /(?:^|[\n;{}])\s*(?:static\s+|inline\s+|extern\s+)?[\w:*&<>\s]+\s+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g;
  const functions = [];
  let match;

  while ((match = headerRe.exec(code)) !== null) {
    const name = match[1];
    if (['if', 'for', 'while', 'switch', 'catch'].includes(name)) continue;
    const bodyStart = headerRe.lastIndex;
    let depth = 1;
    let i = bodyStart;
    for (; i < code.length && depth > 0; i++) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') depth--;
    }
    functions.push({ name, body: code.slice(bodyStart, i - 1) });
    headerRe.lastIndex = i;
  }

  if (functions.length) return functions;
  return [{ name: filename.replace(/\.(c|cpp|cc|cxx|h|hpp)$/i, ''), body: code }];
}

/** Count arithmetic operators as a cheap proxy for expression tree depth. */
function expressionDepth(expr) {
  if (!expr) return 0;
  const ops = expr.match(/[+\-*/%]/g) || [];
  return ops.length;
}

/**
 * Determine the first rule (in priority order) that blocks a variable, matching
 * the Clang tool's `evaluateHeuristics` ordering exactly. Returns '' if safe.
 */
function computeBlockReason(node, thresholds) {
  if (node.type !== 'float') return 'type';
  if (node.isAccumulator) return 'accumulator';
  if (node.hasDivision) return 'division';
  if (node.depth > thresholds.maxDepth) return 'depth';
  if (node.dependencyCount > thresholds.maxFanIn) return 'fan-in';
  if (node.overflowRisk) return 'overflow';
  return '';
}

function fallbackAnalysis(sourceCode, filename, thresholds = DEFAULT_THRESHOLDS) {
  const th = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const functions = splitFunctions(sourceCode, filename).map((fn) => {
    const declRe = /\bfloat\s+([A-Za-z_]\w*)\s*(?:=\s*([^;]+))?;/g;
    const doubleRe = /\bdouble\s+([A-Za-z_]\w*)\s*(?:=\s*[^;]+)?;/g;
    const accumRe = /\b([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=)/g;
    const accumulators = new Set();
    let match;

    while ((match = accumRe.exec(fn.body)) !== null) {
      accumulators.add(match[1]);
    }

    const raw = [];
    while ((match = declRe.exec(fn.body)) !== null) {
      raw.push({ name: match[1], initExpr: match[2] || '', index: match.index });
    }

    const floatNames = new Set(raw.map((n) => n.name));
    const depthByName = new Map();
    const divisionByName = new Map();
    const magnitudeByName = new Map();

    const lineColOf = (name, from) => {
      const before = sourceCode.slice(0, sourceCode.indexOf(name, from));
      const lines = before.split('\n');
      return { line: lines.length, col: lines[lines.length - 1].length + 1 };
    };

    const nodes = raw.map((item) => {
      const words = item.initExpr.match(/\b[A-Za-z_]\w*\b/g) || [];
      const deps = [...new Set(words.filter((w) => floatNames.has(w) && w !== item.name))];
      const depDepth = deps.reduce((max, dep) => Math.max(max, depthByName.get(dep) || 0), 0);
      const depHasDivision = deps.some((dep) => divisionByName.get(dep));
      const depth = expressionDepth(item.initExpr) + depDepth;
      const hasDivision = /[/%]/.test(item.initExpr) || depHasDivision;
      const isAccumulator = accumulators.has(item.name);

      // Range analysis: own literals + inherited magnitude from deps.
      const depMag = deps.reduce((max, dep) => Math.max(max, magnitudeByName.get(dep) ?? -1), -1);
      const maxMagnitude = Math.max(maxLiteralMagnitude(item.initExpr), depMag);
      const overflowRisk = maxMagnitude > FP16_MAX;

      depthByName.set(item.name, depth);
      divisionByName.set(item.name, hasDivision);
      magnitudeByName.set(item.name, maxMagnitude);

      const { line, col } = lineColOf(item.name, item.index);
      const node = {
        name: item.name,
        type: 'float',
        depth,
        hasDivision,
        dependencyCount: deps.length,
        isAccumulator,
        overflowRisk,
        maxMagnitude,
        deps,
        line,
        col,
      };
      const blockReason = computeBlockReason(node, th);
      node.blockReason = blockReason;
      node.isSafe = blockReason === '';
      node.recommendedType = recommendType(blockReason);
      node.errorBound = estimateErrorBound(depth, node.recommendedType);
      node.safetyScore = safetyScore(node, th);
      return node;
    });

    // double locals: reported as type-blocked, never demoted (schema parity
    // with the Clang tool).
    let dmatch;
    while ((dmatch = doubleRe.exec(fn.body)) !== null) {
      const { line, col } = lineColOf(dmatch[1], dmatch.index);
      nodes.push({
        name: dmatch[1],
        type: 'double',
        depth: 0,
        hasDivision: false,
        dependencyCount: 0,
        isAccumulator: false,
        overflowRisk: false,
        maxMagnitude: -1,
        deps: [],
        line,
        col,
        blockReason: 'type',
        isSafe: false,
        recommendedType: 'float',
        errorBound: 0,
        safetyScore: 0,
      });
    }

    const edges = nodes.flatMap((node) => node.deps.map((dep) => ({ from: node.name, to: dep })));
    const safeCount = nodes.filter((node) => node.isSafe).length;
    return {
      name: fn.name,
      totalFloatVars: nodes.length,
      safeToDemote: safeCount,
      nodes,
      edges,
    };
  }).filter((fn) => fn.nodes.length > 0);

  let rewritten = sourceCode;
  for (const fn of functions) {
    for (const node of fn.nodes) {
      if (node.recommendedType !== '__fp16' && node.recommendedType !== '__bf16') continue;
      rewritten = rewritten.replace(
        new RegExp(`\\bfloat\\s+(${node.name})\\b`, 'g'),
        `${node.recommendedType} $1`
      );
    }
  }

  return {
    functions,
    originalSource: sourceCode,
    rewrittenSource: rewritten,
    dryRun: false,
    engine: 'fallback-js',
    mock: true,
    thresholds: th,
  };
}

/** Accept either the historical `safeTodemote` typo or the correct key. */
function normalizeAnalysis(analysis) {
  for (const fn of analysis.functions || []) {
    const safe = fn.safeToDemote ?? fn.safeTodemote ?? 0;
    fn.safeToDemote = safe;
    delete fn.safeTodemote;
    for (const node of fn.nodes || []) {
      if (node.blockReason === undefined) {
        node.blockReason = node.isSafe ? '' : legacyBlockReason(node);
      }
      // Backfill v3 numerical fields for reports from an older tool build.
      if (node.recommendedType === undefined) {
        node.recommendedType = recommendType(node.blockReason);
      }
      if (node.errorBound === undefined) {
        node.errorBound = estimateErrorBound(node.depth || 0, node.recommendedType);
      }
      if (node.safetyScore === undefined) {
        node.safetyScore = safetyScore(
          { ...node, overflowRisk: node.overflowRisk || false },
          DEFAULT_THRESHOLDS
        );
      }
    }
  }
  return analysis;
}

/** Reconstruct a blockReason for reports produced by an older tool build. */
function legacyBlockReason(node) {
  if (node.type && node.type !== 'float') return 'type';
  if (node.isAccumulator) return 'accumulator';
  if (node.hasDivision) return 'division';
  if (node.depth > DEFAULT_THRESHOLDS.maxDepth) return 'depth';
  if (node.dependencyCount > DEFAULT_THRESHOLDS.maxFanIn) return 'fan-in';
  return 'type';
}

function computeMetrics(analysis) {
  const allNodes = (analysis.functions || []).flatMap((f) => f.nodes || []);
  const total = allNodes.length;
  const safe = allNodes.filter((n) => n.isSafe).length;
  const unsafe = total - safe;

  const fp16Count = allNodes.filter((n) => n.recommendedType === '__fp16').length;
  const bf16Count = allNodes.filter((n) => n.recommendedType === '__bf16').length;
  const keptFloatCount = allNodes.filter((n) => (n.recommendedType ?? 'float') === 'float').length;
  // Any var narrowed to a 16-bit type saves 2 bytes (4B -> 2B).
  const narrowedCount = fp16Count + bf16Count;

  const scored = allNodes.filter((n) => n.type === 'float');
  const avgSafetyScore = scored.length
    ? Math.round(scored.reduce((a, n) => a + (n.safetyScore || 0), 0) / scored.length)
    : 0;
  const errBounds = allNodes.filter((n) => (n.errorBound || 0) > 0).map((n) => n.errorBound);
  const maxErrorBound = errBounds.length ? Math.max(...errBounds) : 0;
  const avgErrorBound = errBounds.length
    ? errBounds.reduce((a, b) => a + b, 0) / errBounds.length
    : 0;

  const memorySavedPercent = total > 0 ? +((narrowedCount / total) * 50).toFixed(1) : 0;
  // First-order roofline proxy: on bandwidth-bound kernels, halving the bytes
  // of the narrowed fraction lifts effective throughput by ~1/(1 - saved).
  const savedFraction = total > 0 ? (narrowedCount * 0.5) / total : 0;
  const estimatedSpeedup = +(1 / (1 - Math.min(0.49, savedFraction))).toFixed(2);

  return {
    totalFloatVars: total,
    safeCount: safe,
    unsafeCount: unsafe,
    fp16Count,
    bf16Count,
    keptFloatCount,
    narrowedCount,
    accumulatorCount: allNodes.filter((n) => n.isAccumulator).length,
    divisionBlockedCount: allNodes.filter((n) => n.blockReason === 'division').length,
    depthBlockedCount: allNodes.filter((n) => n.blockReason === 'depth').length,
    fanInBlockedCount: allNodes.filter((n) => n.blockReason === 'fan-in').length,
    typeBlockedCount: allNodes.filter((n) => n.blockReason === 'type').length,
    overflowBlockedCount: allNodes.filter((n) => n.blockReason === 'overflow').length,
    demotionRate: total > 0 ? +((narrowedCount / total) * 100).toFixed(1) : 0,
    avgSafetyScore,
    maxErrorBound,
    avgErrorBound,
    estimatedMaxRelError: maxErrorBound || (safe > 0 ? 0.001 : 0),
    estimatedSpeedup,
    bytesSaved: narrowedCount * 2,
    memorySavedPercent,
    fp16BitWidth: 16,
    fp32BitWidth: 32,
    functionsAnalyzed: analysis.functions?.length || 0,
  };
}

// ── SARIF 2.1.0 export ──────────────────────────────────────────────────────
// Emit a standard Static Analysis Results Interchange Format log so the report
// can be consumed by GitHub code scanning, VS Code SARIF viewers, etc.

const SARIF_RULES = [
  { id: 'PD-SAFE', name: 'DemotableToFP16', level: 'note', text: 'Variable is safe to narrow to __fp16.' },
  { id: 'PD-BF16', name: 'RecommendBF16', level: 'note', text: 'Variable exceeds FP16 range; recommend __bf16.' },
  { id: 'PD-KEEP', name: 'KeepFloat', level: 'warning', text: 'Variable kept at float due to a precision hazard.' },
];

function toSarif(analysis, filename = 'input.cpp') {
  const results = [];
  for (const fn of analysis.functions || []) {
    for (const n of fn.nodes || []) {
      let ruleId = 'PD-KEEP';
      let msg;
      if (n.recommendedType === '__fp16') {
        ruleId = 'PD-SAFE';
        msg = `'${n.name}' is safe to demote to __fp16 (score ${n.safetyScore}, est. rel. error ${(n.errorBound || 0).toExponential(2)}).`;
      } else if (n.recommendedType === '__bf16') {
        ruleId = 'PD-BF16';
        msg = `'${n.name}' exceeds FP16 range — recommend __bf16 (est. rel. error ${(n.errorBound || 0).toExponential(2)}).`;
      } else {
        msg = `'${n.name}' kept at float — ${n.blockReason || 'precision hazard'}.`;
      }
      const rule = SARIF_RULES.find((r) => r.id === ruleId);
      results.push({
        ruleId,
        level: rule.level,
        message: { text: msg },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: filename },
            region: { startLine: n.line || 1, startColumn: n.col || 1 },
          },
        }],
        properties: {
          function: fn.name,
          recommendedType: n.recommendedType,
          safetyScore: n.safetyScore,
          errorBound: n.errorBound,
        },
      });
    }
  }

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'PrecisionDemote',
          informationUri: 'https://github.com/shaswatk45/PrecisionDemote',
          version: '3.0.0',
          rules: SARIF_RULES.map((r) => ({
            id: r.id,
            name: r.name,
            shortDescription: { text: r.text },
            defaultConfiguration: { level: r.level },
          })),
        },
      },
      results,
    }],
  };
}

// ── Example gallery ──────────────────────────────────────────────────────────
// Curated kernels that each showcase a different analysis behaviour.
const EXAMPLES = [
  {
    id: 'dot-product',
    title: 'Dot product',
    blurb: 'Accumulator kept, element loads demoted',
    code: `float dot_product(float* a, float* b, int n) {
    float sum = 0.0f;              // accumulator -> kept
    for (int i = 0; i < n; i++) {
        float ai   = a[i];         // -> __fp16
        float bi   = b[i];         // -> __fp16
        float prod = ai * bi;      // -> __fp16
        sum += prod;
    }
    return sum;
}`,
  },
  {
    id: 'layer-norm',
    title: 'Layer norm',
    blurb: 'Division + accumulators block demotion',
    code: `float layer_norm(float* x, int n) {
    float mean = 0.0f;             // accumulator -> kept
    for (int i = 0; i < n; i++) mean += x[i];
    float inv_n = 1.0f / n;        // division -> kept
    float avg   = mean * inv_n;    // inherits division -> kept
    float shift = x[0] - avg;      // -> __fp16
    return shift;
}`,
  },
  {
    id: 'fp16-overflow',
    title: 'FP16 overflow → BF16',
    blurb: 'Out-of-range constants recommend __bf16',
    code: `float scale_kernel(float* x, int n) {
    float gain   = 70000.0f;       // > 65504 -> __bf16
    float scaled = gain + x[0];    // inherits range -> __bf16
    float small  = x[0] * 0.5f;    // in range -> __fp16
    return scaled + small;
}`,
  },
  {
    id: 'deep-chain',
    title: 'Deep arithmetic chain',
    blurb: 'Depth > 3 blocks the tail of the chain',
    code: `float deep(float a, float b, float c, float d) {
    float t1 = a + b;   // depth 1 -> __fp16
    float t2 = t1 * c;  // depth 2 -> __fp16
    float t3 = t2 - d;  // depth 3 -> __fp16
    float t4 = t3 * t3; // depth 4 -> kept
    float t5 = t4 + 1.0f;
    return t5;
}`,
  },
];

module.exports = {
  DEFAULT_THRESHOLDS,
  FP16_MAX,
  FP16_UNIT_RND,
  BF16_UNIT_RND,
  stripComments,
  splitFunctions,
  expressionDepth,
  maxLiteralMagnitude,
  computeBlockReason,
  recommendType,
  estimateErrorBound,
  safetyScore,
  fallbackAnalysis,
  normalizeAnalysis,
  computeMetrics,
  toSarif,
  EXAMPLES,
};
