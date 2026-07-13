import { useMemo } from 'react'
import { motion } from 'framer-motion'

const REC_COLOR = { __fp16: '#14b8a6', __bf16: '#f59e0b', float: '#f43f5e' }

/**
 * The "risk skyline" — a vertical heatmap strip mirroring the file. Each
 * analysed line gets a bar coloured by its recommended type; kept-at-float
 * lines pulse so the eye snaps straight to the danger. Clicking a bar scrolls
 * the paired editor to that line.
 */
export default function RiskSkyline({ nodes = [], totalLines = 1, editorRef, height = 560 }) {
  const rows = useMemo(() => {
    const byLine = new Map()
    for (const n of nodes) {
      if (!n.line) continue
      const rec = n.recommendedType || (n.isSafe ? '__fp16' : 'float')
      // A risky (kept) verdict wins the pixel if two nodes share a line.
      if (!byLine.has(n.line) || rec === 'float') byLine.set(n.line, { ...n, rec })
    }
    return [...byLine.values()].sort((a, b) => a.line - b.line)
  }, [nodes])

  const lines = Math.max(totalLines, 1)

  return (
    <div
      className="relative w-5 shrink-0 rounded-sm bg-black border border-line overflow-hidden font-sans"
      style={{ height }}
      aria-label="Risk skyline — file-wide precision heatmap"
    >
      {rows.map((n, i) => {
        const col = REC_COLOR[n.rec]
        const top = ((n.line - 0.5) / lines) * 100
        const risky = n.rec === 'float'
        return (
          <motion.button
            key={`${n.name}-${n.line}`}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: risky ? undefined : 0.8, scaleX: 1 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            onClick={() => editorRef?.current?.revealLineInCenter?.(n.line)}
            className={`absolute left-0.5 right-0.5 h-1.5 rounded-sm cursor-pointer origin-left ${risky ? 'pd-risk-row' : ''}`}
            style={{ top: `${top}%`, background: col }}
            title={`L${n.line} ${n.name} → ${n.rec}`}
            aria-label={`Line ${n.line}: ${n.name} → ${n.rec}`}
          />
        )
      })}
    </div>
  )
}
