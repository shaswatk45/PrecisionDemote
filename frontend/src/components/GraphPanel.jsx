import { useState, useCallback, useEffect, useRef } from 'react'
import { ReactFlow, useNodesState, useEdgesState, Background, Controls, Handle, Position } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import dagre from 'dagre'
import RuleGauntlet from './RuleGauntlet'

const REC_STYLE = {
  __fp16: 'border-safe/50 text-safe shadow-glow-safe',
  __bf16: 'border-warn/50 text-warn',
  float:  'border-unsafe/50 text-unsafe shadow-glow-unsafe',
}
const REC_COLOR = { __fp16: '#14b8a6', __bf16: '#f59e0b', float: '#f43f5e' }

function CustomNode({ data }) {
  const rec = data.recommendedType || (data.isSafe ? '__fp16' : 'float')
  const col = REC_COLOR[rec]
  return (
    <>
      {/* Invisible handles — required by React Flow for edges to attach. */}
      <Handle type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0, width: 4, height: 4 }} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={{ opacity: 0, width: 4, height: 4 }} />
    <motion.div
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: data.rippling
          ? `0 0 22px ${col}, 0 0 44px ${col}66`
          : '0 0 0px transparent',
      }}
      transition={{
        opacity: { delay: data.assemblyDelay || 0, type: 'spring', stiffness: 260, damping: 20 },
        scale: { delay: data.assemblyDelay || 0, type: 'spring', stiffness: 260, damping: 20 },
        boxShadow: { duration: 0.3 },
      }}
      className={`px-3 py-2 rounded-lg text-xs font-mono border transition-colors duration-200 shadow-lg bg-surface-900 ${REC_STYLE[rec]} ${data.selected ? 'ring-2 ring-white/60' : ''}`}
    >
      <div className="font-semibold text-center">{data.name}</div>
      <div className="text-[10px] opacity-70 mt-0.5 text-center">{rec} · score {data.safetyScore ?? '-'}</div>
    </motion.div>
    </>
  )
}

const nodeTypes = { custom: CustomNode }

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, edgesep: 20, ranksep: 60 })

  nodes.forEach((node) => { dagreGraph.setNode(node.id, { width: 140, height: 60 }) })
  edges.forEach((edge) => { dagreGraph.setEdge(edge.source, edge.target) })
  dagre.layout(dagreGraph)

  nodes.forEach((node) => {
    const pos = dagreGraph.node(node.id)
    node.targetPosition = 'top'
    node.sourcePosition = 'bottom'
    node.position = { x: pos.x - 70, y: pos.y - 30 }
    return node
  })

  return { nodes, edges }
}

export default function GraphPanel({ analysis }) {
  const thresholds = analysis.thresholds || { maxDepth: 3, maxFanIn: 5 }
  const [selected, setSelected] = useState(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const timersRef = useRef([])

  useEffect(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const initialNodes = []
    const initialEdges = []

    analysis.functions.forEach((fn) => {
      if (!fn.nodes.length) return

      fn.nodes.forEach((node, i) => {
        initialNodes.push({
          id: `${fn.name}-${node.name}`,
          type: 'custom',
          data: { ...node, func: fn.name, label: node.name, assemblyDelay: i * 0.07, rippling: false },
          position: { x: 0, y: 0 },
        })
      })

      fn.edges.forEach((edge) => {
        initialEdges.push({
          id: `e-${fn.name}-${edge.from}-${edge.to}`,
          source: `${fn.name}-${edge.from}`,
          target: `${fn.name}-${edge.to}`,
          animated: true,
          style: { stroke: 'rgba(99,102,241,0.45)', strokeWidth: 2 },
        })
      })
    })

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges)
    setNodes(layoutedNodes)

    // Nodes fly in first; edges draw on once they've settled.
    setEdges([])
    timersRef.current.push(setTimeout(() => setEdges(layoutedEdges), 650))

    // Compounding-error ripple: light each depth tier in order, intensity
    // travelling down the chain — a visual proof of rules 3–5.
    const maxDepth = Math.max(0, ...layoutedNodes.map((n) => n.data.depth || 0))
    for (let tier = 0; tier <= maxDepth; tier++) {
      timersRef.current.push(setTimeout(() => {
        setNodes((nds) => nds.map((n) => ({
          ...n, data: { ...n.data, rippling: (n.data.depth || 0) === tier },
        })))
      }, 1400 + tier * 380))
    }
    timersRef.current.push(setTimeout(() => {
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, rippling: false } })))
    }, 1400 + (maxDepth + 1) * 380))

    return () => { timersRef.current.forEach(clearTimeout) }
  }, [analysis, setNodes, setEdges])

  const onNodeClick = useCallback((event, node) => {
    setSelected(node.data)
    setNodes(nds => nds.map(n => {
      n.data = { ...n.data, selected: n.id === node.id }
      return n
    }))
  }, [setNodes])

  const allNodes = analysis.functions.flatMap(f => f.nodes.map(n => ({ ...n, func: f.name })))
  const recOf = (n) => n.recommendedType || (n.isSafe ? '__fp16' : 'float')
  const fp16Nodes = allNodes.filter(n => recOf(n) === '__fp16')
  const bf16Nodes = allNodes.filter(n => recOf(n) === '__bf16')
  const keptNodes = allNodes.filter(n => recOf(n) === 'float')

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass hud-corners p-1 space-y-2 h-[600px] flex flex-col relative overflow-hidden"
    >
      <div className="flex items-center gap-4 flex-wrap p-4 z-10 absolute top-0 left-0 right-0 pointer-events-none">
        <p className="section-title mb-0">Dependency Graph</p>
        <span className="tag-safe pointer-events-auto">{fp16Nodes.length} __fp16</span>
        <span className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>{bf16Nodes.length} __bf16</span>
        <span className="tag-unsafe pointer-events-auto">{keptNodes.length} kept</span>
      </div>

      <div className="flex-1 w-full h-full rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-surface-900/30"
          minZoom={0.1}
        >
          <Background color="#6366f1" gap={24} size={1} opacity={0.15} />
          <Controls className="fill-white text-black" style={{ background: 'rgba(0,0,0,0.5)' }} />
        </ReactFlow>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`absolute right-4 top-16 w-80 max-h-[500px] overflow-y-auto border rounded-xl p-5 shadow-2xl backdrop-blur-xl ${selected.isSafe ? 'border-safe/30 bg-black/90' : 'border-unsafe/30 bg-black/90'}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-lg font-bold text-white truncate">{selected.name}</span>
              <span className="ml-auto font-mono text-xs text-gray-400">score {selected.safetyScore ?? '-'}/100</span>
              <button onClick={() => {
                setSelected(null)
                setNodes(nds => nds.map(n => { n.data.selected = false; return n }))
              }} className="text-gray-500 hover:text-white text-lg px-1">✕</button>
            </div>

            {/* Diagnostic gauntlet — the 6 rules fire in sequence */}
            <RuleGauntlet node={selected} thresholds={thresholds} />

            <div className="grid grid-cols-2 gap-2 text-sm mt-4">
              {[
                ['Type', selected.type],
                ['Line', selected.line ? `L${selected.line}` : '-'],
                ['Rel. err', selected.errorBound ? `${(selected.errorBound * 100).toFixed(3)}%` : '0%'],
                ['Max mag', selected.maxMagnitude > 0 ? Number(selected.maxMagnitude).toPrecision(3) : '—'],
              ].map(([label, val]) => (
                <div key={label} className="bg-white/5 p-2 rounded">
                  <div className="text-[10px] text-gray-400 uppercase">{label}</div>
                  <div className="font-mono text-white text-xs mt-0.5">{String(val)}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
