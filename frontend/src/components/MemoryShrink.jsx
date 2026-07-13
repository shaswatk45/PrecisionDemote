import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const FORMATS = {
  fp32: { label: 'FP32', bits: 32, parts: [1, 8, 23], color: '#ffffff', caption: 'baseline — 4 bytes per variable' },
  fp16: { label: '__fp16', bits: 16, parts: [1, 5, 10], color: '#14b8a6', caption: 'half the bytes — range ±65504' },
  bf16: { label: '__bf16', bits: 16, parts: [1, 8, 7], color: '#f59e0b', caption: 'same exponent as FP32 — full range kept' },
}
const PART_LABELS = ['sign', 'exponent', 'mantissa']
const PART_SHADES = ['#888888', null, null]

/**
 * The physical memory story: 32 bit-cells collapse into 16, then
 * re-partition to show the FP16 vs BF16 exponent/mantissa trade-off. Loops
 * through fp32 → fp16 → bf16 automatically.
 */
export default function MemoryShrink({ interval = 2600 }) {
  const [phase, setPhase] = useState('fp32')

  useEffect(() => {
    const order = ['fp32', 'fp16', 'bf16']
    const t = setInterval(() => {
      setPhase((p) => order[(order.indexOf(p) + 1) % order.length])
    }, interval)
    return () => clearInterval(t)
  }, [interval])

  const f = FORMATS[phase]
  const cells = Array.from({ length: 32 }, (_, i) => i)

  const partOf = (i) => {
    if (i >= f.bits) return -1
    if (i < f.parts[0]) return 0
    if (i < f.parts[0] + f.parts[1]) return 1
    return 2
  }
  const cellColor = (i) => {
    const p = partOf(i)
    if (p === -1) return 'transparent'
    if (p === 0) return PART_SHADES[0]
    if (p === 1) return f.color
    return `${f.color}66`
  }

  return (
    <div className="space-y-4 font-sans uppercase">
      {/* Header: format name + byte count */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <motion.span
          key={f.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-xl font-bold"
          style={{ color: f.color }}
        >
          {f.label}
        </motion.span>
        <span className="font-mono text-xs text-mute font-bold">{f.bits} bits · {f.bits / 8} bytes</span>
        <span className="ml-auto text-[11px] text-stone font-bold font-mono tracking-wider">{f.caption}</span>
      </div>

      {/* The 32 bit-cells — extra 16 collapse away in the 16-bit phases */}
      <div className="flex gap-[3px] bg-black p-1 border border-line rounded-sm">
        {cells.map((i) => {
          const alive = i < f.bits
          return (
            <motion.div
              key={i}
              className="h-6 rounded-none"
              animate={{
                flexGrow: alive ? 1 : 0.0001,
                opacity: alive ? 1 : 0,
                backgroundColor: alive ? cellColor(i) : '#000000',
              }}
              transition={{ duration: 0.55, ease: 'easeInOut', delay: alive ? 0 : (31 - i) * 0.012 }}
              style={{ flexBasis: 0, minWidth: 0 }}
            />
          )
        })}
      </div>

      {/* Partition legend */}
      <div className="flex gap-5 text-[10px] font-mono tracking-wider">
        {PART_LABELS.map((label, idx) => (
          <span key={label} className="flex items-center gap-1.5 text-mute">
            <span
              className="w-2.5 h-2.5 rounded-sm inline-block"
              style={{ background: idx === 0 ? PART_SHADES[0] : idx === 1 ? f.color : `${f.color}66` }}
            />
            {label}
            <motion.span key={`${phase}-${idx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-stone">
              ×{f.parts[idx]}
            </motion.span>
          </span>
        ))}
      </div>
    </div>
  )
}
