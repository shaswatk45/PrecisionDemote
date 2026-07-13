import { useState } from 'react'
import { motion } from 'framer-motion'
import { reasonLabel } from '../lib/blockReason'

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'safetyScore', label: 'Score' },
  { key: 'depth', label: 'Depth' },
  { key: 'dependencyCount', label: 'Fan-in' },
]

const REC_BADGE = {
  __fp16: 'bg-safe/15 text-safe border-safe/40',
  __bf16: 'bg-warn/15 text-warn border-warn/40',
  float: 'bg-unsafe/15 text-unsafe border-unsafe/40',
}

function scoreColor(s) {
  if (s >= 75) return '#14b8a6'
  if (s >= 40) return '#f59e0b'
  return '#f43f5e'
}

const fmtErr = (e) => (e > 0 ? `${(e * 100).toFixed(3)}%` : '—')

export default function NodeTable({ analysis }) {
  const [sort, setSort] = useState({ key: 'safetyScore', dir: -1 })
  const [filter, setFilter] = useState('all')
  const thresholds = analysis.thresholds || { maxDepth: 3, maxFanIn: 5 }
  const allNodes = analysis.functions.flatMap(f => f.nodes.map(n => ({ ...n, func: f.name })))

  const filtered = allNodes.filter(n => {
    const rec = n.recommendedType || (n.isSafe ? '__fp16' : 'float')
    if (filter === 'fp16') return rec === '__fp16'
    if (filter === 'bf16') return rec === '__bf16'
    if (filter === 'kept') return rec === 'float'
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort.key] ?? 0
    const bv = b[sort.key] ?? 0
    if (typeof av === 'number') return (av - bv) * sort.dir
    return String(av).localeCompare(String(bv)) * sort.dir
  })

  const toggleSort = (key) => {
    setSort(prev => prev.key === key ? { key, dir: -prev.dir } : { key, dir: -1 })
  }

  const filters = [
    ['all', 'All'],
    ['fp16', '__fp16'],
    ['bf16', '__bf16'],
    ['kept', 'Kept'],
  ]

  return (
    <div className="nv-panel p-6 space-y-4 relative font-sans">
      <div className="corner-square" />
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-nv mb-0 mr-2">Variable Analysis Table</p>
        <div className="flex gap-2 ml-auto">
          {filters.map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-sm font-bold uppercase tracking-wider transition-all ${filter === f ? 'bg-nv text-black' : 'text-mute hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto rounded-sm border border-line">
        <table className="w-full text-xs text-left uppercase">
          <thead>
            <tr className="border-b border-line text-stone text-[10px] tracking-wider font-bold bg-[#080808]">
              <th className="pb-3 pt-3 pl-4 pr-4">Func</th>
              <th className="pb-3 pt-3 pr-4 cursor-pointer hover:text-white select-none" onClick={() => toggleSort('name')}>Name</th>
              <th className="pb-3 pt-3 pr-4 cursor-pointer hover:text-white select-none" onClick={() => toggleSort('safetyScore')}>Score</th>
              <th className="pb-3 pt-3 pr-4">Target</th>
              <th className="pb-3 pt-3 pr-4 cursor-pointer hover:text-white select-none" onClick={() => toggleSort('depth')}>Depth</th>
              <th className="pb-3 pt-3 pr-4 cursor-pointer hover:text-white select-none" onClick={() => toggleSort('dependencyCount')}>Fan-in</th>
              <th className="pb-3 pt-3 pr-4">Rel. err</th>
              <th className="pb-3 pt-3 pr-4">Line</th>
              <th className="pb-3 pt-3 pr-4">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((node, i) => {
              const rec = node.recommendedType || (node.isSafe ? '__fp16' : 'float')
              const reason = reasonLabel(node, thresholds)
              const score = node.safetyScore ?? 0
              return (
                <motion.tr
                  key={`${node.func}-${node.name}-${i}`}
                  className="hover:bg-white/5 transition-colors"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                >
                  <td className="py-3 pl-4 pr-4 text-mute font-mono">{node.func}</td>
                  <td className="py-3 pr-4 font-mono font-bold text-white normal-case">
                    {node.name}
                    {node.type !== 'float' && <span className="ml-1 text-[10px] text-stone">({node.type})</span>}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 min-w-[92px]">
                      <div className="flex-1 h-1.5 rounded-sm bg-white/10 overflow-hidden">
                        <div className="h-full rounded-sm" style={{ width: `${score}%`, background: scoreColor(score) }} />
                      </div>
                      <span className="font-mono text-xs font-bold" style={{ color: scoreColor(score) }}>{score}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded-sm border ${REC_BADGE[rec]}`}>{rec}</span>
                  </td>
                  <td className="py-3 pr-4"><span className={`font-mono ${node.depth > thresholds.maxDepth ? 'text-unsafe' : 'text-white'}`}>{node.depth}</span></td>
                  <td className="py-3 pr-4"><span className={`font-mono ${node.dependencyCount > thresholds.maxFanIn ? 'text-unsafe' : 'text-white'}`}>{node.dependencyCount}</span></td>
                  <td className="py-3 pr-4 font-mono text-[11px] text-mute">{fmtErr(node.errorBound || 0)}</td>
                  <td className="py-3 pr-4 font-mono text-[11px] text-stone">{node.line ? `L${node.line}` : '—'}</td>
                  <td className="py-3 pr-4 text-[10px]">
                    {reason
                      ? <span className="tag-unsafe" title={reason}>{reason}</span>
                      : <span className="tag-safe">safe</span>}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>

        {sorted.length === 0 && <div className="text-center py-12 text-stone uppercase tracking-wider font-mono">No variables match the current filter.</div>}
      </div>

      <p className="text-[10px] text-mute uppercase font-mono tracking-wider">{sorted.length} of {allNodes.length} variables shown</p>
    </div>
  )
}
