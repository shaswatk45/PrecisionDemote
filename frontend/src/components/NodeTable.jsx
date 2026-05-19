import { useState } from 'react'
import { motion } from 'framer-motion'

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'depth', label: 'Depth' },
  { key: 'dependencyCount', label: 'Fan-in' },
  { key: 'isSafe', label: 'Safe' },
]

export default function NodeTable({ analysis }) {
  const [sort, setSort] = useState({ key: 'isSafe', dir: -1 })
  const [filter, setFilter] = useState('all')
  const allNodes = analysis.functions.flatMap(f => f.nodes.map(n => ({ ...n, func: f.name })))

  const filtered = allNodes.filter(n => {
    if (filter === 'safe') return n.isSafe
    if (filter === 'unsafe') return !n.isSafe
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    if (typeof av === 'boolean') return (bv - av) * sort.dir
    if (typeof av === 'number') return (av - bv) * sort.dir
    return String(av).localeCompare(String(bv)) * sort.dir
  })

  const toggleSort = (key) => {
    setSort(prev => prev.key === key ? { key, dir: -prev.dir } : { key, dir: -1 })
  }

  const getBlockReason = (node) => {
    if (node.isSafe) return null
    if (node.isAccumulator) return 'Accumulator'
    if (node.hasDivision) return 'Division chain'
    if (node.depth > 3) return `Depth ${node.depth} > 3`
    if (node.dependencyCount > 5) return `Fan-in ${node.dependencyCount} > 5`
    return 'Type mismatch'
  }

  return (
    <div className="glass p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="section-title mb-0 mr-2">Variable Analysis Table</p>
        <div className="flex gap-2 ml-auto">
          {['all', 'safe', 'unsafe'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg capitalize transition-all ${filter === f ? f === 'safe' ? 'bg-safe/20 text-safe border border-safe/40' : f === 'unsafe' ? 'bg-unsafe/20 text-unsafe border border-unsafe/40' : 'bg-accent/20 text-accent border border-accent/40' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto rounded-lg">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
              <th className="pb-3 pr-4">Func</th>
              {SORT_OPTIONS.map(col => (
                <th key={col.key} className="pb-3 pr-4 cursor-pointer hover:text-white transition-colors select-none" onClick={() => toggleSort(col.key)}>
                  <span className="flex items-center gap-1">
                    {col.label}
                    <span className="text-[10px]">{sort.key === col.key ? (sort.dir > 0 ? 'up' : 'down') : 'sort'}</span>
                  </span>
                </th>
              ))}
              <th className="pb-3 pr-4">Line</th>
              <th className="pb-3 pr-4">Div?</th>
              <th className="pb-3 pr-4">Accum?</th>
              <th className="pb-3 pr-4">Deps</th>
              <th className="pb-3">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((node, i) => {
              const reason = getBlockReason(node)
              return (
                <motion.tr
                  key={`${node.func}-${node.name}-${i}`}
                  className="hover:bg-white/5 transition-colors"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{node.func}</td>
                  <td className="py-3 pr-4 font-mono font-semibold text-white">{node.name}</td>
                  <td className="py-3 pr-4"><span className={`font-mono ${node.depth > 3 ? 'text-unsafe' : 'text-safe'}`}>{node.depth}</span></td>
                  <td className="py-3 pr-4"><span className={`font-mono ${node.dependencyCount > 5 ? 'text-unsafe' : 'text-gray-300'}`}>{node.dependencyCount}</span></td>
                  <td className="py-3 pr-4">{node.isSafe ? <span className="text-gray-400">-</span> : <span className="text-warn">blocked</span>}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-500">{node.line ? `L${node.line}` : '-'}</td>
                  <td className="py-3 pr-4"><span className={node.hasDivision ? 'text-unsafe' : 'text-gray-400'}>{node.hasDivision ? 'Yes' : '-'}</span></td>
                  <td className="py-3 pr-4"><span className={node.isAccumulator ? 'text-warn' : 'text-gray-400'}>{node.isAccumulator ? 'Yes' : '-'}</span></td>
                  <td className="py-3 pr-4 text-xs text-gray-400">{node.deps?.length > 0 ? node.deps.join(', ') : '-'}</td>
                  <td className="py-3">{node.isSafe ? <span className="tag-safe">to __fp16</span> : <span className="tag-unsafe" title={reason}>{reason || 'keep float'}</span>}</td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>

        {sorted.length === 0 && <div className="text-center py-12 text-gray-500">No variables match the current filter.</div>}
      </div>

      <p className="text-xs text-gray-500">{sorted.length} of {allNodes.length} variables shown</p>
    </div>
  )
}
