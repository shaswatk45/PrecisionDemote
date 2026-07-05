import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Type, Repeat, Divide, Link2, GitMerge, Gauge, Check, X, ArrowRight } from 'lucide-react'

const TEAL = '#14b8a6', ROSE = '#f43f5e', AMBER = '#f59e0b'

// The 6 safety rules in engine priority order — mirrors evaluateHeuristics().
const RULES = [
  { key: 'type', icon: Type, name: 'Type', test: (n) => n.type === 'float', detail: (n) => n.type },
  { key: 'accumulator', icon: Repeat, name: 'Accumulator', test: (n) => !n.isAccumulator, detail: (n) => (n.isAccumulator ? '+= detected' : 'none') },
  { key: 'division', icon: Divide, name: 'Division', test: (n) => !n.hasDivision, detail: (n) => (n.hasDivision ? 'in chain' : 'none') },
  { key: 'depth', icon: Link2, name: 'Depth', test: (n, th) => n.depth <= th.maxDepth, detail: (n, th) => `${n.depth} / ${th.maxDepth}` },
  { key: 'fan-in', icon: GitMerge, name: 'Fan-in', test: (n, th) => n.dependencyCount <= th.maxFanIn, detail: (n, th) => `${n.dependencyCount} / ${th.maxFanIn}` },
  { key: 'overflow', icon: Gauge, name: 'Range', test: (n) => !n.overflowRisk, detail: (n) => (n.overflowRisk ? `|${Number(n.maxMagnitude).toPrecision(3)}| > 65504` : '≤ 65504') },
]

/**
 * The diagnostic gauntlet: fires the 6 safety rules at one variable in
 * sequence. Each rule pulses while "checking", locks teal on pass, and slams
 * rose at the first failure (later rules stay unevaluated — exactly how the
 * engine short-circuits). An overflow failure ends with the BF16 redirect
 * flourish instead of a plain block.
 */
export default function RuleGauntlet({ node, thresholds = { maxDepth: 3, maxFanIn: 5 }, stepMs = 480 }) {
  const [step, setStep] = useState(0) // rules with index < step are resolved

  const failIndex = RULES.findIndex((r) => !r.test(node, thresholds))
  const stopAt = failIndex === -1 ? RULES.length : failIndex + 1
  const done = step >= stopAt
  const failed = failIndex !== -1 && done
  const redirected = failed && RULES[failIndex].key === 'overflow'

  useEffect(() => {
    setStep(0)
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setStep(i)
      if (i >= stopAt) clearInterval(timer)
    }, stepMs)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.name, node?.line])

  return (
    <div className="space-y-1.5">
      {RULES.map((rule, i) => {
        const Icon = rule.icon
        const resolved = i < step
        const checking = i === step && i < stopAt
        const skipped = failed && i > failIndex
        const pass = resolved && rule.test(node, thresholds)
        const fail = resolved && !pass

        const col = fail ? ROSE : pass ? TEAL : '#4b5563'

        return (
          <motion.div
            key={rule.key}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 border ${fail ? 'pd-redline' : ''}`}
            animate={{
              borderColor: checking ? 'rgba(129,140,248,0.5)' : fail ? `${ROSE}66` : pass ? `${TEAL}33` : 'rgba(255,255,255,0.06)',
              backgroundColor: fail ? 'rgba(244,63,94,0.10)' : pass ? 'rgba(20,184,166,0.06)' : 'rgba(255,255,255,0.02)',
              opacity: skipped ? 0.3 : 1,
              scale: fail ? [1, 1.04, 1] : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            <motion.span
              animate={checking ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
              transition={checking ? { repeat: Infinity, duration: 0.6 } : {}}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: checking ? '#818cf8' : col }} />
            </motion.span>

            <span className="text-xs font-medium" style={{ color: skipped ? '#4b5563' : resolved ? '#e2e8f0' : '#6b7280' }}>
              {rule.name}
            </span>
            <span className="ml-auto font-mono text-[10px] text-gray-500">
              {skipped ? '—' : rule.detail(node, thresholds)}
            </span>

            <span className="w-4 flex justify-center">
              {pass && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
                  <Check className="w-3.5 h-3.5" style={{ color: TEAL }} />
                </motion.span>
              )}
              {fail && (
                <motion.span initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }}>
                  <X className="w-3.5 h-3.5" style={{ color: ROSE }} />
                </motion.span>
              )}
              {checking && <span className="w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse" />}
            </span>
          </motion.div>
        )
      })}

      {/* Verdict stamp */}
      {done && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: redirected ? 0.5 : 0.15 }}
            className="rounded-lg px-3 py-2 border text-xs font-semibold flex items-center gap-2"
            style={redirected
              ? { borderColor: `${AMBER}66`, background: `${AMBER}14`, color: AMBER }
              : failed
                ? { borderColor: `${ROSE}55`, background: `${ROSE}10`, color: ROSE }
                : { borderColor: `${TEAL}55`, background: `${TEAL}10`, color: TEAL }}
          >
            {redirected ? (
              <>
                <Gauge className="w-3.5 h-3.5" />
                Redirected <ArrowRight className="w-3 h-3" /> <span className="font-mono">__bf16</span>
                <span className="font-normal text-[10px] opacity-80 ml-1">same size, wider range</span>
              </>
            ) : failed ? (
              <>Kept at <span className="font-mono">float</span> — blocked by {RULES[failIndex].name.toLowerCase()}</>
            ) : (
              <>All 6 rules pass <ArrowRight className="w-3 h-3" /> <span className="font-mono">__fp16</span></>
            )}
          </motion.div>
      )}
    </div>
  )
}
