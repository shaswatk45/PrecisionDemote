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

      depthByName.set(item.name, depth);
      divisionByName.set(item.name, hasDivision);

      const { line, col } = lineColOf(item.name, item.index);
      const node = {
        name: item.name,
        type: 'float',
        depth,
        hasDivision,
        dependencyCount: deps.length,
        isAccumulator,
        deps,
        line,
        col,
      };
      const blockReason = computeBlockReason(node, th);
      node.blockReason = blockReason;
      node.isSafe = blockReason === '';
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
        deps: [],
        line,
        col,
        blockReason: 'type',
        isSafe: false,
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
      if (!node.isSafe) continue;
      rewritten = rewritten.replace(new RegExp(`\\bfloat\\s+(${node.name})\\b`, 'g'), '__fp16 $1');
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

  return {
    totalFloatVars: total,
    safeCount: safe,
    unsafeCount: unsafe,
    accumulatorCount: allNodes.filter((n) => n.isAccumulator).length,
    divisionBlockedCount: allNodes.filter((n) => n.blockReason === 'division').length,
    depthBlockedCount: allNodes.filter((n) => n.blockReason === 'depth').length,
    fanInBlockedCount: allNodes.filter((n) => n.blockReason === 'fan-in').length,
    typeBlockedCount: allNodes.filter((n) => n.blockReason === 'type').length,
    demotionRate: total > 0 ? +((safe / total) * 100).toFixed(1) : 0,
    estimatedMaxRelError: safe > 0 ? 0.001 : 0,
    // Each demoted var drops FP32 (4B) -> FP16 (2B): a 50% cut on those vars.
    bytesSaved: safe * 2,
    memorySavedPercent: total > 0 ? Math.round((safe / total) * 50) : 0,
    fp16BitWidth: 16,
    fp32BitWidth: 32,
    functionsAnalyzed: analysis.functions?.length || 0,
  };
}

module.exports = {
  DEFAULT_THRESHOLDS,
  stripComments,
  splitFunctions,
  expressionDepth,
  computeBlockReason,
  fallbackAnalysis,
  normalizeAnalysis,
  computeMetrics,
};
