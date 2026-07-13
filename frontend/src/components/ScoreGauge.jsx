import { motion } from 'framer-motion'
import CountUp from './CountUp'

// SVG radial gauge — the arc draws itself on mount.
// Flat engineering design with no soft shadows or decorative glow.
export default function ScoreGauge({ value = 0, size = 140, stroke = 10, sublabel = 'score', color, duration = 1.1 }) {
  const r = (size - stroke) / 2 - 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const col = color || (pct >= 75 ? '#14b8a6' : pct >= 40 ? '#f59e0b' : '#f43f5e')

  return (
    <div className="relative flex items-center justify-center font-sans" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={col} strokeWidth={stroke} fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration, ease: 'easeOut' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="gauge-center">
        <div className="text-3xl font-black font-mono" style={{ color: col }}>
          <CountUp value={Math.round(pct)} duration={duration * 1000} />
        </div>
        <div className="text-[10px] text-mute uppercase font-mono tracking-widest mt-0.5">{sublabel}</div>
      </div>
    </div>
  )
}
