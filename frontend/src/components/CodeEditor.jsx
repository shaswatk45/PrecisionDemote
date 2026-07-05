import { useRef, useEffect, useCallback, useState } from 'react'
import Editor from '@monaco-editor/react'
import { motion, AnimatePresence } from 'framer-motion'
import monaco from '../lib/monaco'
import { reasonLabel } from '../lib/blockReason'

const KIND = {
  __fp16: { cls: 'pd-line-fp16', glyph: 'pd-glyph-fp16' },
  __bf16: { cls: 'pd-line-bf16', glyph: 'pd-glyph-bf16' },
  float:  { cls: 'pd-line-keep', glyph: 'pd-glyph-keep' },
}

const REC_COLOR = { __fp16: '#14b8a6', __bf16: '#f59e0b', float: '#f43f5e' }

/** The animated "reasoning replay" card shown when hovering an analysed line. */
function HoverCard({ node, x, y }) {
  const rec = node.recommendedType || (node.isSafe ? '__fp16' : 'float')
  const col = REC_COLOR[rec]
  const score = node.safetyScore ?? 0
  const err = node.errorBound ? Number(node.errorBound).toExponential(2) : '0'
  const reason = reasonLabel(node)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="absolute z-30 w-64 rounded-xl border bg-black/90 backdrop-blur-xl p-4 shadow-2xl pointer-events-none"
      style={{ left: x, top: y, borderColor: `${col}55` }}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold text-white text-sm">{node.name}</span>
        <span
          className="ml-auto font-mono text-[10px] px-2 py-0.5 rounded border"
          style={{ color: col, borderColor: `${col}66`, background: `${col}1a` }}
        >
          {rec === 'float' ? 'keep float' : `→ ${rec}`}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            <span>safety score</span>
            <span className="font-mono" style={{ color: col }}>{score}/100</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: col, boxShadow: `0 0 8px ${col}` }}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-gray-500">est. rel. error</span>
          <span className="font-mono text-gray-300">{err}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">depth · fan-in</span>
          <span className="font-mono text-gray-300">{node.depth} · {node.dependencyCount}</span>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-[11px] pt-1 border-t border-white/10"
          style={{ color: col }}
        >
          {reason ? `Blocked — ${reason}` : 'Passes all 6 safety rules'}
        </motion.div>
      </div>
    </motion.div>
  )
}

/**
 * Monaco-based C/C++ editor. When `nodes` are supplied it paints per-line
 * decorations (teal __fp16 / amber __bf16 / rose kept). `scanProgress`
 * (0..1 while a compiler-pass sweep is running, null otherwise) renders the
 * glowing scanline overlay. Hovering an analysed line pops the animated
 * reasoning-replay card.
 */
export default function CodeEditor({
  value, onChange, readOnly = false, nodes = [], height = 440,
  onRun, onEditorMount, scanProgress = null,
}) {
  const editorRef = useRef(null)
  const decoRef = useRef(null)
  const containerRef = useRef(null)
  const nodesRef = useRef(nodes)
  const lastPaintRef = useRef(-1)
  const [hover, setHover] = useState(null)

  nodesRef.current = nodes

  const paint = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    if (!model) return
    const lineCount = model.getLineCount()
    const list = (nodes || []).filter((n) => n.line && n.line <= lineCount)

    // Skip redundant repaints during the scan sweep (same visible set).
    const sig = list.length * 100000 + (list[list.length - 1]?.line || 0)
    if (sig === lastPaintRef.current) return
    lastPaintRef.current = sig

    const decorations = list.map((n) => {
      const rec = n.recommendedType || (n.isSafe ? '__fp16' : 'float')
      const kind = KIND[rec] || KIND.float
      return {
        range: new monaco.Range(n.line, 1, n.line, 1),
        options: {
          isWholeLine: true,
          className: kind.cls,
          linesDecorationsClassName: kind.glyph,
        },
      }
    })

    if (!decoRef.current) decoRef.current = editor.createDecorationsCollection(decorations)
    else decoRef.current.set(decorations)
  }, [nodes])

  useEffect(() => { paint() }, [paint])

  function handleMount(editor, monacoInstance) {
    editorRef.current = editor
    if (onRun) {
      editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => onRun())
    }
    // Monaco can initialise before the flex/grid parent has resolved its height,
    // leaving the editor collapsed. Force a re-measure once layout settles.
    requestAnimationFrame(() => editor.layout())
    setTimeout(() => editor.layout(), 80)

    // Reasoning-replay hover: track the line under the cursor and pop the card.
    editor.onMouseMove((e) => {
      const line = e.target?.position?.lineNumber
      const list = nodesRef.current || []
      const node = line ? list.find((n) => n.line === line) : null
      if (!node) { setHover((h) => (h ? null : h)); return }
      const rect = containerRef.current?.getBoundingClientRect()
      const be = e.event?.browserEvent
      if (!rect || !be) return
      const rawX = be.clientX - rect.left + 16
      const rawY = be.clientY - rect.top + 12
      const x = Math.min(rawX, rect.width - 272)
      const y = Math.min(rawY, rect.height - 190)
      setHover((h) => (h && h.node === node && Math.abs(h.x - x) < 24 && Math.abs(h.y - y) < 24
        ? h : { node, x, y }))
    })
    editor.onMouseLeave(() => setHover(null))

    lastPaintRef.current = -1
    paint()
    onEditorMount?.(editor)
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden" style={{ height }}>
      <Editor
        height="100%"
        language="cpp"
        theme="precision-dark"
        value={value}
        onChange={(v) => onChange?.(v ?? '')}
        onMount={handleMount}
        options={{
          readOnly,
          fontSize: 13,
          fontFamily: 'JetBrains Mono, Fira Code, monospace',
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          padding: { top: 14, bottom: 14 },
          lineNumbersMinChars: 3,
          glyphMargin: true,
          renderLineHighlight: 'gutter',
          automaticLayout: true,
          tabSize: 4,
          hover: { enabled: false }, // our animated card replaces Monaco's hover
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        }}
        loading={<div className="p-6 text-gray-500 text-sm">Loading editor…</div>}
      />

      {/* Compiler-pass scanline sweep */}
      {scanProgress !== null && scanProgress < 1 && (
        <div
          className="pd-scanline"
          style={{ top: `calc(${(scanProgress * 100).toFixed(2)}% - 22px)` }}
        />
      )}

      <AnimatePresence>
        {hover && <HoverCard key={hover.node.name + hover.node.line} node={hover.node} x={hover.x} y={hover.y} />}
      </AnimatePresence>
    </div>
  )
}
