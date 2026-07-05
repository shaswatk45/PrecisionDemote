import { motion } from 'framer-motion'
import CountUp from './CountUp'

// SVG radial gauge — the arc draws itself on mount with a colour-keyed glow,
// and the centre number counts up in sync. No chart lib; exact arc control.
export default function ScoreGauge({ value = 0, size = 140, stroke = 10, sublabel = 'score', color, duration = 1.1 }) {
  const r = (size - stroke) / 2 - 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const col = color || (pct >= 75 ? '#14b8a6' : pct >= 40 ? '#f59e0b' : '#f43f5e')

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={col} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration, ease: 'easeOut' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 6px ${col}88)` }}
        />
      </svg>
      <div className="gauge-center">
        <div className="text-3xl font-extrabold" style={{ color: col, textShadow: `0 0 18px ${col}66` }}>
          <CountUp value={Math.round(pct)} duration={duration * 1000} />
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{sublabel}</div>
      </div>
    </div>
  )
}
