import { useMemo } from 'react'
import { motion } from 'framer-motion'

const REC_COLOR = { __fp16: '#14b8a6', __bf16: '#f59e0b', float: '#f43f5e' }

/**
 * Oscilloscope-style trace of the estimated relative error bound across all
 * variables (in source order). The stroke draws itself on mount; sample dots
 * are colour-keyed by recommended type. Pure SVG — no chart lib.
 */
export default function ErrorTrace({ nodes = [], width = 640, height = 160 }) {
  const samples = useMemo(
    () => (nodes || [])
      .filter((n) => n.type === 'float')
      .sort((a, b) => (a.line || 0) - (b.line || 0)),
    [nodes]
  )

  const pad = { l: 46, r: 12, t: 14, b: 24 }
  const iw = width - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const maxErr = Math.max(1e-4, ...samples.map((n) => n.errorBound || 0))

  const pts = samples.map((n, i) => ({
    x: pad.l + (samples.length === 1 ? iw / 2 : (i / (samples.length - 1)) * iw),
    y: pad.t + ih - ((n.errorBound || 0) / maxErr) * ih,
    n,
  }))
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const gridY = [0, 0.5, 1]

  if (samples.length === 0) return null

  return (
    <div className="hud-scanlines rounded-sm border border-line bg-black p-2 font-sans">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
        {/* Grid */}
        {gridY.map((g) => {
          const y = pad.t + ih - g * ih
          return (
            <g key={g}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 5" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#4b5563" fontFamily="monospace">
                {(g * maxErr).toExponential(0)}
              </text>
            </g>
          )
        })}

        {/* The trace draws itself */}
        {pts.length > 1 && (
          <motion.path
            d={path}
            fill="none"
            stroke="#76b900"
            strokeWidth="1.5"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
          />
        )}

        {/* Sample dots, colour-keyed by recommendation */}
        {pts.map((p, i) => {
          const rec = p.n.recommendedType || (p.n.isSafe ? '__fp16' : 'float')
          const col = REC_COLOR[rec]
          return (
            <motion.g key={`${p.n.name}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + i * 0.06 }}>
              <circle cx={p.x} cy={p.y} r="3" fill={col} />
              <text x={p.x} y={height - 8} textAnchor="middle" fontSize="9" fill="#6b7280" fontFamily="monospace">
                {p.n.name.length > 6 ? p.n.name.slice(0, 5) + '…' : p.n.name}
              </text>
            </motion.g>
          )
        })}

        <text x={pad.l} y={10} fontSize="9" fill="#6b7280" fontFamily="monospace" letterSpacing="1" className="font-bold">
          REL. ERROR BOUND / VARIABLE
        </text>
      </svg>
    </div>
  )
}
