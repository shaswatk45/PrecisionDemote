import { useEffect, useRef, useState } from 'react'

/**
 * Animated count-up number. Re-runs whenever `value` changes, easing from the
 * previous displayed value to the new one — big cinematic reveals for stats.
 *
 * Props:
 *   value      target number
 *   duration   ms (default 900)
 *   decimals   fixed decimal places (default 0)
 *   prefix / suffix   strings rendered around the number
 *   format     optional (n) => string, overrides decimals formatting
 */
export default function CountUp({ value = 0, duration = 900, decimals = 0, prefix = '', suffix = '', format }) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const from = fromRef.current
    const to = Number(value) || 0
    const start = performance.now()

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutCubic — fast start, gentle settle
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }

    rafRef.current = requestAnimationFrame(tick)
    // Guarantee settlement even if rAF stalls (hidden tab, busy main thread).
    const settle = setTimeout(() => { setDisplay(to); fromRef.current = to }, duration + 120)
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(settle) }
  }, [value, duration])

  const text = format ? format(display) : display.toFixed(decimals)
  return <span>{prefix}{text}{suffix}</span>
}
