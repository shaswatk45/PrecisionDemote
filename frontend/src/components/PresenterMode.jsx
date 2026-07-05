import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react'
import GraphPanel from './GraphPanel'
import CodeDiff from './CodeDiff'
import ScoreGauge from './ScoreGauge'
import CountUp from './CountUp'
import MemoryShrink from './MemoryShrink'
import RuleGauntlet from './RuleGauntlet'
import useScanReveal from '../lib/useScanReveal'

const REC_COLOR = { __fp16: '#14b8a6', __bf16: '#f59e0b', float: '#f43f5e' }
const BEAT_MS = 8000

/** Lightweight cinematic code pane — per-line ignition behind a scanline. */
function CodeCinema({ source, nodes }) {
  const { visibleNodes, progress, scanning } = useScanReveal(nodes, { duration: 2400 })
  const lines = useMemo(() => (source || '').split('\n'), [source])
  const byLine = useMemo(() => {
    const m = new Map()
    for (const n of visibleNodes) {
      const rec = n.recommendedType || (n.isSafe ? '__fp16' : 'float')
      if (!m.has(n.line) || rec === 'float') m.set(n.line, rec)
    }
    return m
  }, [visibleNodes])

  return (
    <div className="relative rounded-xl border border-white/10 bg-[#0a0e17] overflow-hidden hud-scanlines">
      {scanning && (
        <div className="pd-scanline" style={{ top: `calc(${(progress * 100).toFixed(2)}% - 22px)` }} />
      )}
      <pre className="p-6 font-mono text-[13px] leading-relaxed overflow-auto max-h-[52vh]">
        {lines.map((text, i) => {
          const rec = byLine.get(i + 1)
          const col = rec ? REC_COLOR[rec] : null
          return (
            <div
              key={i}
              className="px-3 -mx-3 rounded transition-colors duration-500"
              style={col ? { background: `${col}1f`, borderLeft: `2px solid ${col}`, color: '#e2e8f0' } : { color: '#94a3b8', borderLeft: '2px solid transparent' }}
            >
              <span className="inline-block w-8 text-right mr-4 text-gray-600 select-none">{i + 1}</span>
              {text || ' '}
              {rec && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="ml-3 text-[10px] font-bold"
                  style={{ color: col }}
                >
                  {rec === 'float' ? '× kept' : `→ ${rec}`}
                </motion.span>
              )}
            </div>
          )
        })}
      </pre>
    </div>
  )
}

/**
 * Presenter Mode — an auto-playing, produced walkthrough of the analysis.
 * Space / → advances, ← goes back, P pauses, Esc exits. Each beat auto-
 * advances after 8s so the presenter talks while the tool performs.
 */
export default function PresenterMode({ analysis, code, onClose }) {
  const [beat, setBeat] = useState(0)
  const [paused, setPaused] = useState(false)

  const allNodes = useMemo(
    () => (analysis ? analysis.functions.flatMap((f) => f.nodes) : []),
    [analysis]
  )
  const m = analysis?.metrics

  // The most dramatic variable for the gauntlet beat: an overflow→BF16
  // redirect if one exists, else the first blocked var, else the first var.
  const gauntletNode = useMemo(() => {
    if (!allNodes.length) return null
    return allNodes.find((n) => n.blockReason === 'overflow')
      || allNodes.find((n) => !n.isSafe && n.type === 'float')
      || allNodes[0]
  }, [allNodes])

  const beats = useMemo(() => {
    if (!analysis) return []
    return [
      {
        title: 'The compiler pass',
        caption: 'Clang walks the real AST — every float ignites as the scanline reads it.',
        render: () => <CodeCinema source={analysis.originalSource} nodes={allNodes} />,
      },
      {
        title: 'The dependency graph assembles',
        caption: 'Variables fly in, edges connect, and a ripple traces how error compounds down the chain.',
        render: () => <GraphPanel analysis={analysis} />,
      },
      {
        title: 'Six rules, fired in sequence',
        caption: gauntletNode?.blockReason === 'overflow'
          ? `"${gauntletNode.name}" overflows FP16's range — watch the engine redirect it to __bf16.`
          : `Every variable runs the same gauntlet — the first failing rule decides its fate.`,
        render: () => (
          <div className="grid md:grid-cols-[auto_1fr] gap-10 items-center max-w-3xl mx-auto">
            <ScoreGauge value={m?.avgSafetyScore ?? 0} size={200} stroke={14} sublabel="avg score" duration={1.4} />
            <div className="space-y-3">
              <div className="font-mono text-sm text-gray-400">
                variable: <span className="text-white font-bold">{gauntletNode?.name}</span>
              </div>
              {gauntletNode && <RuleGauntlet node={gauntletNode} thresholds={analysis.thresholds} stepMs={620} />}
            </div>
          </div>
        ),
      },
      {
        title: 'Memory, physically',
        caption: '32 bits collapse to 16 — and BF16 re-partitions to keep FP32\'s full range.',
        render: () => (
          <div className="max-w-3xl mx-auto space-y-8">
            <MemoryShrink interval={2200} />
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                ['bytes saved', m?.bytesSaved ?? 0, '', '#14b8a6'],
                ['memory cut', m?.memorySavedPercent ?? 0, '%', '#818cf8'],
                ['est. speedup', m?.estimatedSpeedup ?? 1, '×', '#f59e0b'],
              ].map(([label, val, suffix, col]) => (
                <div key={label} className="glass hud-corners p-5">
                  <div className="text-4xl font-extrabold font-mono" style={{ color: col }}>
                    <CountUp value={val} decimals={suffix === '×' ? 2 : suffix === '%' ? 1 : 0} suffix={suffix} duration={1300} />
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: 'The rewrite',
        caption: 'Mixed precision, emitted in place — __fp16 and __bf16 side by side, comments untouched.',
        render: () => <CodeDiff original={analysis.originalSource} rewritten={analysis.rewrittenSource} />,
      },
    ]
  }, [analysis, allNodes, m, gauntletNode])

  const next = useCallback(() => setBeat((b) => Math.min(b + 1, beats.length - 1)), [beats.length])
  const prev = useCallback(() => setBeat((b) => Math.max(b - 1, 0)), [])

  // Keyboard: space/→ next, ← prev, P pause, Esc exit.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (e.key.toLowerCase() === 'p') { e.preventDefault(); setPaused((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose])

  // Auto-advance.
  useEffect(() => {
    if (paused || !beats.length || beat >= beats.length - 1) return
    const t = setTimeout(next, BEAT_MS)
    return () => clearTimeout(t)
  }, [beat, paused, beats.length, next])

  const b = beats[beat]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col hud-scanlines"
    >
      {/* Top bar */}
      <div className="flex items-center px-8 py-5">
        <span className="font-mono text-xs tracking-[0.3em] text-accent-light">PRESENTER MODE</span>
        <span className="ml-4 font-mono text-xs text-gray-600">
          {String(beat + 1).padStart(2, '0')} / {String(Math.max(beats.length, 1)).padStart(2, '0')}
        </span>
        <button onClick={onClose} className="ml-auto text-gray-500 hover:text-white transition-colors" aria-label="Exit presenter mode">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Beat content */}
      <div className="flex-1 overflow-auto px-8 flex items-center">
        <div className="w-full max-w-5xl mx-auto">
          {!analysis ? (
            <div className="text-center text-gray-400 space-y-3">
              <div className="spinner w-8 h-8 mx-auto" />
              <p>Waiting for the first analysis to finish…</p>
            </div>
          ) : (
            <motion.div
              key={beat}
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            >
              {b?.render()}
            </motion.div>
          )}
        </div>
      </div>

      {/* Caption + controls */}
      <div className="px-8 pb-8 pt-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            key={`cap-${beat}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">{b?.title || ''}</h2>
            <p className="text-gray-400 mt-1.5">{b?.caption || ''}</p>
          </motion.div>

          <div className="flex items-center gap-4 mt-5">
            <button onClick={prev} disabled={beat === 0} className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors" aria-label="Previous beat">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setPaused((p) => !p)} className="text-accent-light hover:text-white transition-colors" aria-label={paused ? 'Resume' : 'Pause'}>
              {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>
            <button onClick={next} disabled={beat >= beats.length - 1} className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors" aria-label="Next beat">
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Beat progress dots */}
            <div className="flex items-center gap-2 ml-2">
              {beats.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setBeat(i)}
                  className="relative h-1.5 rounded-full overflow-hidden transition-all"
                  style={{ width: i === beat ? 56 : 20, background: 'rgba(255,255,255,0.12)' }}
                  aria-label={`Go to beat ${i + 1}`}
                >
                  {i < beat && <span className="absolute inset-0 bg-accent-light/70" />}
                  {i === beat && !paused && (
                    <motion.span
                      key={`prog-${beat}`}
                      className="absolute inset-y-0 left-0 bg-accent-light"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: BEAT_MS / 1000, ease: 'linear' }}
                    />
                  )}
                  {i === beat && paused && <span className="absolute inset-y-0 left-0 w-1/2 bg-accent-light/60" />}
                </button>
              ))}
            </div>

            <span className="ml-auto font-mono text-[10px] text-gray-600 hidden md:block">
              SPACE next · ← back · P pause · ESC exit
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
