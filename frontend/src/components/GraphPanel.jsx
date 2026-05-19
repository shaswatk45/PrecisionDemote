import { useState, useCallback, useEffect } from 'react'
import { ReactFlow, useNodesState, useEdgesState, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import dagre from 'dagre'

function CustomNode({ data }) {
  const safe = data.isSafe
  return (
    <div className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all duration-200 shadow-lg bg-surface-900 ${safe ? 'border-safe/40 text-safe shadow-glow-safe' : 'border-unsafe/40 text-unsafe shadow-glow-unsafe'} ${data.selected ? 'ring-2 ring-white/60 scale-105' : ''}`}>
      <div className="font-semibold text-center">{data.name}</div>
      <div className="text-[10px] opacity-70 mt-0.5 text-center">depth:{data.depth} deps:{data.dependencyCount}</div>
    </div>
  )
}

const nodeTypes = { custom: CustomNode }

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, edgesep: 20, ranksep: 60 })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 140, height: 60 })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    node.targetPosition = 'top'
    node.sourcePosition = 'bottom'
    node.position = {
      x: nodeWithPosition.x - 140 / 2,
      y: nodeWithPosition.y - 60 / 2,
    }
    return node
  })

  return { nodes, edges }
}

export default function GraphPanel({ analysis }) {
  const [selected, setSelected] = useState(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    const initialNodes = []
    const initialEdges = []

    analysis.functions.forEach((fn) => {
      if (!fn.nodes.length) return
      
      fn.nodes.forEach(node => {
        initialNodes.push({
          id: `${fn.name}-${node.name}`,
          type: 'custom',
          data: { ...node, func: fn.name, label: node.name },
          position: { x: 0, y: 0 }
        })
      })

      fn.edges.forEach(edge => {
        initialEdges.push({
          id: `e-${fn.name}-${edge.from}-${edge.to}`,
          source: `${fn.name}-${edge.from}`,
          target: `${fn.name}-${edge.to}`,
          animated: true,
          style: { stroke: 'rgba(239,68,68,0.4)', strokeWidth: 2 }
        })
      })
    })

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges)
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [analysis, setNodes, setEdges])

  const onNodeClick = useCallback((event, node) => {
    setSelected(node.data)
    setNodes(nds => nds.map(n => {
      n.data = { ...n.data, selected: n.id === node.id }
      return n
    }))
  }, [setNodes])

  const allNodes = analysis.functions.flatMap(f => f.nodes.map(n => ({ ...n, func: f.name })))
  const safeNodes = allNodes.filter(n => n.isSafe)
  const unsafeNodes = allNodes.filter(n => !n.isSafe)

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass p-1 space-y-2 h-[600px] flex flex-col relative overflow-hidden"
    >
      <div className="flex items-center gap-4 flex-wrap p-4 z-10 absolute top-0 left-0 right-0 pointer-events-none">
        <p className="section-title mb-0">Dependency Graph</p>
        <span className="tag-safe pointer-events-auto">{safeNodes.length} safe</span>
        <span className="tag-unsafe pointer-events-auto">{unsafeNodes.length} blocked</span>
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
          <Background color="#ef4444" gap={24} size={1} opacity={0.15} />
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
            className={`absolute right-4 top-16 w-80 border rounded-xl p-5 shadow-2xl backdrop-blur-xl ${selected.isSafe ? 'border-safe/30 bg-black/90' : 'border-unsafe/30 bg-black/90'}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-lg font-bold text-white truncate">{selected.name}</span>
              <button onClick={() => {
                setSelected(null)
                setNodes(nds => nds.map(n => { n.data.selected = false; return n }))
              }} className="ml-auto text-gray-500 hover:text-white text-lg px-2">✕</button>
            </div>

            <div className="mb-4">
               {selected.isSafe ? <span className="tag-safe">Safe {'->'} __fp16</span> : <span className="tag-unsafe">Keep float</span>}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mt-4">
              {[
                ['Type', selected.type],
                ['Depth', selected.depth],
                ['Deps', selected.dependencyCount],
                ['Line', selected.line ? `L${selected.line}` : '-'],
              ].map(([label, val]) => (
                <div key={label} className="bg-white/5 p-2 rounded">
                  <div className="text-[10px] text-gray-400 uppercase">{label}</div>
                  <div className="font-mono text-white text-xs mt-0.5">{String(val)}</div>
                </div>
              ))}
            </div>
            <div className={`mt-4 text-[11px] p-3 rounded-lg ${selected.isSafe ? 'bg-safe/10 text-safe' : 'bg-unsafe/10 text-unsafe'}`}>
              {selected.isSafe ? 'Passed all checks: depth <= 3, no division, fan-in <= 5, not accumulator.' : `Blocked. Accumulator: ${selected.isAccumulator}, Div: ${selected.hasDivision}`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
