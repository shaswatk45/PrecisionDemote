import { useRef, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import monaco from '../lib/monaco'

const KIND = {
  __fp16: { cls: 'pd-line-fp16', glyph: 'pd-glyph-fp16', label: '→ __fp16' },
  __bf16: { cls: 'pd-line-bf16', glyph: 'pd-glyph-bf16', label: '→ __bf16' },
  float:  { cls: 'pd-line-keep', glyph: 'pd-glyph-keep', label: 'kept float' },
}

function hoverFor(node) {
  const rec = node.recommendedType || (node.isSafe ? '__fp16' : 'float')
  const verdict = rec === 'float' ? `kept \`float\`` : `demote to \`${rec}\``
  const err = node.errorBound ? Number(node.errorBound).toExponential(2) : '0'
  const lines = [
    `**\`${node.name}\`** — ${verdict}`,
    '',
    `- safety score: **${node.safetyScore ?? '-'}/100**`,
    `- est. rel. error: \`${err}\``,
    node.blockReason ? `- blocked by: \`${node.blockReason}\`` : `- passes all rules`,
    `- depth ${node.depth} · fan-in ${node.dependencyCount}`,
  ]
  return { value: lines.join('\n') }
}

/**
 * Monaco-based C/C++ editor. When `nodes` (flat analysis nodes) are supplied it
 * paints per-line decorations — teal for __fp16, amber for __bf16, rose for kept
 * — turning the source itself into the analysis surface, with hover details.
 */
export default function CodeEditor({ value, onChange, readOnly = false, nodes = [], height = 440, onRun }) {
  const editorRef = useRef(null)
  const decoRef = useRef(null)

  const paint = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    if (!model) return
    const lineCount = model.getLineCount()

    const decorations = (nodes || [])
      .filter((n) => n.line && n.line <= lineCount)
      .map((n) => {
        const rec = n.recommendedType || (n.isSafe ? '__fp16' : 'float')
        const kind = KIND[rec] || KIND.float
        return {
          range: new monaco.Range(n.line, 1, n.line, 1),
          options: {
            isWholeLine: true,
            className: kind.cls,
            linesDecorationsClassName: kind.glyph,
            hoverMessage: hoverFor(n),
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
    paint()
  }

  return (
    <Editor
      height={height}
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
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      }}
      loading={<div className="p-6 text-gray-500 text-sm">Loading editor…</div>}
    />
  )
}
