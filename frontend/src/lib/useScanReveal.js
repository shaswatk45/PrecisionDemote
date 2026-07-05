import { useEffect, useRef, useState, useMemo, useCallback } from 'react'

/**
 * The "compiler pass" reveal. Given the full set of analysis nodes, sweeps a
 * progress value 0→1 over `duration` ms; consumers get:
 *
 *   visibleNodes — only the nodes whose source line the scanline has passed
 *   progress     — 0..1 sweep position (drives the scanline overlay's `top`)
 *   scanning     — true while the sweep is running
 *   start()      — (re)start the sweep
 *
 * Progress is derived from the wall clock and advanced by BOTH an rAF loop and
 * an interval fallback — rAF stops entirely in hidden/背景 tabs, and a demo
 * must never leave the sweep stuck half-way. A hard timeout guarantees
 * completion no matter what.
 */
export default function useScanReveal(nodes, { duration = 1800, autoStart = true } = {}) {
  const [progress, setProgress] = useState(autoStart ? 0 : 1)
  const [scanning, setScanning] = useState(false)
  const handlesRef = useRef({ raf: null, interval: null, timeout: null })

  const maxLine = useMemo(
    () => (nodes || []).reduce((m, n) => Math.max(m, n.line || 0), 0),
    [nodes]
  )

  const stopTimers = () => {
    const h = handlesRef.current
    cancelAnimationFrame(h.raf)
    clearInterval(h.interval)
    clearTimeout(h.timeout)
  }

  const start = useCallback(() => {
    stopTimers()
    if (!nodes || nodes.length === 0) { setProgress(1); setScanning(false); return }
    setScanning(true)
    setProgress(0)
    const t0 = performance.now()

    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / duration)
      setProgress(t)
      if (t >= 1) { setScanning(false); stopTimers() }
      return t
    }

    const rafLoop = () => {
      if (step() < 1) handlesRef.current.raf = requestAnimationFrame(rafLoop)
    }
    handlesRef.current.raf = requestAnimationFrame(rafLoop)
    handlesRef.current.interval = setInterval(step, 120)
    handlesRef.current.timeout = setTimeout(step, duration + 150)
  }, [nodes, duration])

  // Auto-start whenever the node set changes (a fresh analysis arrived).
  useEffect(() => {
    if (autoStart) start()
    return stopTimers
  }, [start, autoStart])

  const visibleNodes = useMemo(() => {
    if (!nodes || nodes.length === 0) return []
    if (!scanning && progress >= 1) return nodes
    // Reveal by source line: the scanline has passed line L when
    // progress * (maxLine + slack) >= L.
    const revealLine = progress * (maxLine + 2)
    return nodes.filter((n) => (n.line || 0) <= revealLine)
  }, [nodes, progress, scanning, maxLine])

  return { visibleNodes, progress, scanning, start }
}
