import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// Bit partitions per format: [sign, exponent, mantissa]
const FORMATS = {
  fp32: { label: 'FP32', bits: 32, parts: [1, 8, 23], color: '#6366f1', caption: 'baseline — 4 bytes per variable' },
  fp16: { label: '__fp16', bits: 16, parts: [1, 5, 10], color: '#14b8a6', caption: 'half the bytes — range ±65504' },
  bf16: { label: '__bf16', bits: 16, parts: [1, 8, 7], color: '#f59e0b', caption: 'same exponent as FP32 — full range kept' },
}
const PART_LABELS = ['sign', 'exponent', 'mantissa']
const PART_SHADES = ['#e2e8f0', null, null] // exponent/mantissa take the format colour at 2 opacities

/**
 * The physical memory story: 32 glowing bit-cells collapse into 16, then
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

  // Which partition does bit i belong to in the current format?
  const partOf = (i) => {
    if (i >= f.bits) return -1 // collapsed
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
    <div className="space-y-4">
      {/* Header: format name + byte count */}
      <div className="flex items-baseline gap-3">
        <motion.span
          key={f.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-2xl font-extrabold"
          style={{ color: f.color, textShadow: `0 0 16px ${f.color}55` }}
        >
          {f.label}
        </motion.span>
        <span className="font-mono text-sm text-gray-500">{f.bits} bits · {f.bits / 8} bytes</span>
        <span className="ml-auto text-xs text-gray-500">{f.caption}</span>
      </div>

      {/* The 32 bit-cells — extra 16 collapse away in the 16-bit phases */}
      <div className="flex gap-[3px]">
        {cells.map((i) => {
          const alive = i < f.bits
          return (
            <motion.div
              key={i}
              className="h-8 rounded-[3px]"
              animate={{
                flexGrow: alive ? 1 : 0.0001,
                opacity: alive ? 1 : 0,
                backgroundColor: alive ? cellColor(i) : '#000000',
                boxShadow: alive && partOf(i) === 1 ? `0 0 8px ${f.color}88` : '0 0 0px transparent',
              }}
              transition={{ duration: 0.55, ease: 'easeInOut', delay: alive ? 0 : (31 - i) * 0.012 }}
              style={{ flexBasis: 0, minWidth: 0 }}
            />
          )
        })}
      </div>

      {/* Partition legend */}
      <div className="flex gap-5 text-[11px] font-mono">
        {PART_LABELS.map((label, idx) => (
          <span key={label} className="flex items-center gap-1.5 text-gray-400">
            <span
              className="w-2.5 h-2.5 rounded-sm inline-block"
              style={{ background: idx === 0 ? PART_SHADES[0] : idx === 1 ? f.color : `${f.color}66` }}
            />
            {label}
            <motion.span key={`${phase}-${idx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-500">
              ×{f.parts[idx]}
            </motion.span>
          </span>
        ))}
      </div>
    </div>
  )
}
