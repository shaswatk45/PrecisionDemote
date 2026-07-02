// Human-friendly labels for the analyzer's machine `blockReason` codes.
// The analyzer (Clang tool *and* JS fallback) is the single source of truth for
// *why* a variable was kept; the UI only maps codes to prose.

const LABELS = {
  type: 'Not float',
  accumulator: 'Accumulator',
  division: 'Division chain',
  depth: 'Depth exceeded',
  'fan-in': 'Fan-in exceeded',
}

/**
 * Return a display label for why `node` was kept at float, or null if it is
 * safe to demote. Prefers the analyzer-provided `blockReason`; falls back to
 * re-deriving it for reports produced by an older tool build.
 */
export function reasonLabel(node, thresholds = { maxDepth: 3, maxFanIn: 5 }) {
  if (node.isSafe) return null

  const code = node.blockReason
  if (code) {
    if (code === 'depth') return `Depth ${node.depth} > ${thresholds.maxDepth}`
    if (code === 'fan-in') return `Fan-in ${node.dependencyCount} > ${thresholds.maxFanIn}`
    return LABELS[code] || 'Kept at float'
  }

  // Legacy fallback (matches the analyzer's priority order).
  if (node.type && node.type !== 'float') return LABELS.type
  if (node.isAccumulator) return LABELS.accumulator
  if (node.hasDivision) return LABELS.division
  if (node.depth > thresholds.maxDepth) return `Depth ${node.depth} > ${thresholds.maxDepth}`
  if (node.dependencyCount > thresholds.maxFanIn) return `Fan-in ${node.dependencyCount} > ${thresholds.maxFanIn}`
  return 'Kept at float'
}
