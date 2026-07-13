import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'

function saveBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function ExportMenu({ analysis, code }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const exportRewritten = () => {
    saveBlob(analysis.rewrittenSource || code, 'rewritten.mixed.cpp', 'text/x-c++src')
    toast.success('Rewritten source saved')
    setOpen(false)
  }

  const exportJson = () => {
    saveBlob(JSON.stringify(analysis, null, 2), 'analysis.json', 'application/json')
    toast.success('analysis.json saved')
    setOpen(false)
  }

  const exportSarif = async () => {
    setOpen(false)
    try {
      const { data } = await axios.post('/api/sarif', { code, filename: 'input.cpp' })
      saveBlob(JSON.stringify(data, null, 2), 'precision-demote.sarif', 'application/sarif+json')
      toast.success('SARIF log saved')
    } catch {
      toast.error('SARIF export failed')
    }
  }

  const items = [
    ['Rewritten source (.cpp)', 'Mixed __fp16 / __bf16 output', exportRewritten],
    ['Analysis (.json)', 'Full report incl. scores & error bounds', exportJson],
    ['SARIF 2.1.0 (.sarif)', 'GitHub code-scanning compatible', exportSarif],
  ]

  return (
    <div className="relative font-sans" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-ghost text-xs px-4 py-2 flex items-center gap-2"
        aria-haspopup="true"
        aria-expanded={open}
      >
        Export
        <span className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 nv-panel overflow-hidden z-50 shadow-nv-glow bg-black"
          >
            <div className="corner-square" />
            {items.map(([label, sub, fn]) => (
              <button
                key={label}
                onClick={fn}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-line last:border-0"
              >
                <div className="text-xs text-white font-bold uppercase tracking-wider">{label}</div>
                <div className="text-[11px] text-mute uppercase font-mono mt-0.5">{sub}</div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
