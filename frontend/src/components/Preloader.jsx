import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const BOOT_LINES = [
  { pct: 12, text: 'initializing nvidia-emea typeface and layout engine' },
  { pct: 38, text: 'checking clang ast compiler binary via local wsl' },
  { pct: 64, text: 'caching float-to-fp16 translation rules [6/6]' },
  { pct: 86, text: 'loading design tokens and surface boundaries' },
  { pct: 100, text: 'precision demote ready.' },
]
const STEP_MS = 250

export default function Preloader() {
  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem('pd-booted') } catch { return true }
  })
  const [fading, setFading] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!visible) return
    if (step >= BOOT_LINES.length) {
      const t1 = setTimeout(() => setFading(true), 300)
      const t2 = setTimeout(() => {
        setVisible(false)
        try { sessionStorage.setItem('pd-booted', '1') } catch { /* private mode */ }
      }, 700)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [visible, step])

  const pct = step === 0 ? 4 : BOOT_LINES[Math.min(step, BOOT_LINES.length) - 1].pct

  return (
    <>
      {visible && (
        <motion.div
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center font-sans"
        >
          <div className="w-[400px] max-w-[85vw] space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-sm bg-nv flex items-center justify-center text-[10px] font-bold text-black font-mono">16</span>
              <span className="font-mono text-xs text-ink uppercase tracking-widest">precision demote</span>
              <span className="ml-auto font-mono text-xs text-nv">{pct}%</span>
            </div>

            {/* Build-style progress bar */}
            <div className="h-1 bg-surface-elevated overflow-hidden rounded-sm">
              <motion.div
                className="h-full bg-nv"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            </div>

            {/* Boot log */}
            <div className="font-mono text-[11px] space-y-2 min-h-[96px] text-mute uppercase">
              {BOOT_LINES.slice(0, step).map((l, i) => (
                <motion.div
                  key={l.text}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={i === BOOT_LINES.length - 1 && step >= BOOT_LINES.length ? 'text-nv' : 'text-mute'}
                >
                  <span className="text-stone">[{String(l.pct).padStart(3, ' ')}%]</span> {l.text}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </>
  )
}
