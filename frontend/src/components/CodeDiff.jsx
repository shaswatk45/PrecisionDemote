import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

function highlightFP16Lines(code) {
  return code.split('\n').reduce((acc, line, idx) => {
    if (line.includes('__fp16')) acc.push(idx + 1)
    return acc
  }, [])
}

const SyntaxPanel = ({ code, title, badge, badgeClass }) => {
  const fp16Lines = highlightFP16Lines(code)
  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <span className="text-xs text-gray-400 font-mono">{title}</span>
        {badge && <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-semibold ${badgeClass}`}>{badge}</span>}
      </div>
      <div className="relative flex-1 overflow-auto">
        <SyntaxHighlighter
          language="cpp"
          style={vscDarkPlus}
          customStyle={{ margin: 0, background: 'transparent', fontSize: '13px', lineHeight: '1.7', padding: '1rem' }}
          wrapLines
          showLineNumbers
          lineNumberStyle={{ color: '#374151', fontSize: '11px' }}
          lineProps={(lineNum) => {
            const style = {}
            if (fp16Lines.includes(lineNum)) {
              style.background = 'rgba(20,184,166,0.08)'
              style.borderLeft = '2px solid rgba(20,184,166,0.7)'
              style.paddingLeft = '6px'
            }
            return { style }
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

export default function CodeDiff({ original, rewritten }) {
  const [view, setView] = useState('split')
  const changed = original !== rewritten
  const fp16Count = (rewritten.match(/__fp16/g) || []).length

  return (
    <div className="glass overflow-hidden flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-wrap">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Source Comparison</span>
        {changed ? (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-safe/10 border border-safe/30 text-safe font-semibold">
            {fp16Count} __fp16 substitution{fp16Count !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-gray-500/20 border border-gray-500/30 text-gray-400">No changes</span>
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
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${view === id ? 'bg-accent/20 text-accent border border-accent/40' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`flex ${view === 'split' ? 'gap-0 divide-x divide-white/10' : ''} overflow-auto min-h-[400px] max-h-[600px]`}>
        {(view === 'split' || view === 'original') && <SyntaxPanel code={original} title="original.cpp - FP32" badge="float" badgeClass="bg-unsafe/10 border border-unsafe/30 text-unsafe" />}
        {(view === 'split' || view === 'rewritten') && <SyntaxPanel code={rewritten} title="rewritten.cpp - FP16 demoted" badge="__fp16" badgeClass="bg-safe/10 border border-safe/30 text-safe" />}
      </div>

      <div className="px-4 py-2.5 border-t border-white/10 text-[11px] text-gray-500 flex gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded bg-safe/20 border-l-2 border-safe/60" />
          Lines with __fp16 demotion
        </div>
        <div className="ml-auto">FP16 uses 2 bytes vs FP32's 4 bytes.</div>
      </div>
    </div>
  )
}
