import { useState } from 'react'
import toast from 'react-hot-toast'

function SyntaxPanel({ code, title, badge, badgeClass }) {
  return (
    <div className="flex-1 flex flex-col min-w-[320px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface-dark">
        <span className="text-xs font-mono text-mute uppercase tracking-wider">{title}</span>
        {badge && (
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm ${badgeClass}`}>
            {badge}
          </span>
        )}
      </div>
      <pre className="code-block flex-1 p-4 text-xs font-mono text-mute overflow-auto bg-black leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export default function CodeDiff({ original, rewritten }) {
  const [view, setView] = useState('split')

  const copyRewritten = () => {
    navigator.clipboard.writeText(rewritten)
    toast.success('Copied rewritten code to clipboard')
  }

  const origCount = (original.match(/float\s/g) || []).length
  const rewCount = (rewritten.match(/float\s/g) || []).length
  const fp16Count = origCount - rewCount
  const changed = fp16Count > 0

  const downloadRewritten = () => {
    const blob = new Blob([rewritten], { type: 'text/x-c++src' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rewritten.fp16.cpp'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success('Downloaded rewritten.fp16.cpp')
  }

  return (
    <div className="nv-panel overflow-hidden flex flex-col relative">
      <div className="corner-square" />
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line flex-wrap bg-[#050505]">
        <span className="text-xs font-bold text-ink uppercase tracking-wider">Source Comparison</span>
        {changed ? (
          <span className="text-[10px] px-2.5 py-0.5 rounded-sm bg-safe/10 border border-safe/30 text-safe font-bold uppercase tracking-wider">
            {fp16Count} __fp16 substitution{fp16Count !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[10px] px-2.5 py-0.5 rounded-sm bg-[#1a1a1a] border border-line text-stone uppercase tracking-wider">No changes</span>
        )}
        <div className="flex gap-2 ml-auto">
          {[
            ['split', 'Split'],
            ['original', 'Original'],
            ['rewritten', 'Rewritten'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-sm transition-all ${view === id ? 'bg-nv text-black' : 'text-mute hover:text-white'}`}
            >
              {label}
            </button>
          ))}
          <div className="w-px bg-line mx-1" aria-hidden="true" />
          <button
            onClick={copyRewritten}
            aria-label="Copy rewritten source to clipboard"
            className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-sm text-mute hover:text-white"
          >
            Copy
          </button>
          <button
            onClick={downloadRewritten}
            aria-label="Download rewritten source file"
            className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-sm bg-nv/10 border border-nv/30 text-nv hover:bg-nv/20 transition-all"
          >
            Download
          </button>
        </div>
      </div>

      <div className={`flex ${view === 'split' ? 'gap-0 divide-x divide-line' : ''} overflow-auto min-h-[400px] max-h-[600px]`}>
        {(view === 'split' || view === 'original') && <SyntaxPanel code={original} title="original.cpp - FP32" badge="float" badgeClass="bg-unsafe/10 border border-unsafe/30 text-unsafe" />}
        {(view === 'split' || view === 'rewritten') && <SyntaxPanel code={rewritten} title="rewritten.cpp - FP16 demoted" badge="__fp16" badgeClass="bg-safe/10 border border-safe/30 text-safe" />}
      </div>

      <div className="px-4 py-2.5 border-t border-line text-[10px] uppercase font-bold tracking-wider text-mute flex gap-4 bg-[#050505] font-mono">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-safe/20 border-l-2 border-safe/60" />
          Lines with __fp16 demotion
        </div>
        <div className="ml-auto lowercase font-normal">FP16 uses 2 bytes vs FP32's 4 bytes.</div>
      </div>
    </div>
  )
}
