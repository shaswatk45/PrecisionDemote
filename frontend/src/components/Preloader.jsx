import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// Real-build-style boot lines — each appears in sequence with its progress.
const BOOT_LINES = [
  { pct: 12, text: 'linking LLVM 18.1.3 · libclang-cpp.so' },
  { pct: 38, text: 'loading Clang AST engine' },
  { pct: 64, text: 'calibrating FP16 unit roundoff (2^-11)' },
  { pct: 86, text: 'indexing safety rules [6/6]' },
  { pct: 100, text: 'precision-demote ready.' },
]
const STEP_MS = 320

/**
 * "Compiling…" boot gate. Plays once per browser session (sessionStorage),
 * ~1.8s of build log + progress bar, then lifts to reveal the app. Sets a
 * serious, cinematic tone before anything is clicked.
 */
export default function Preloader() {
  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem('pd-booted') } catch { return true }
  })
  const [fading, setFading] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!visible) return
    if (step >= BOOT_LINES.length) {
      // State-driven fade-out — never depends on an exit animation completing.
      const t1 = setTimeout(() => setFading(true), 420)
      const t2 = setTimeout(() => {
        setVisible(false)
        try { sessionStorage.setItem('pd-booted', '1') } catch { /* private mode */ }
      }, 1000)
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
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[200] bg-[#05070d] hud-scanlines flex items-center justify-center"
        >
          <div className="w-[420px] max-w-[85vw] space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-safe via-accent to-unsafe flex items-center justify-center text-[11px] font-bold text-white">16</span>
              <span className="font-mono text-sm text-gray-300 tracking-wider">precision-demote <span className="text-gray-600">v3</span></span>
              <span className="ml-auto font-mono text-xs text-accent-light">{pct}%</span>
            </div>

            {/* Build-style progress bar */}
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent to-safe"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ boxShadow: '0 0 12px rgba(99,102,241,0.7)', animation: 'pd-progress-glow 1s ease-in-out infinite' }}
              />
            </div>

            {/* Boot log */}
            <div className="font-mono text-[11px] space-y-1.5 min-h-[96px]">
              {BOOT_LINES.slice(0, step).map((l, i) => (
                <motion.div
                  key={l.text}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={i === BOOT_LINES.length - 1 && step >= BOOT_LINES.length ? 'text-safe' : 'text-gray-500'}
                >
                  <span className="text-gray-700">[{String(l.pct).padStart(3, ' ')}%]</span> {l.text}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </>
  )
}
