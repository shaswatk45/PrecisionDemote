import { useNavigate } from 'react-router-dom'
import GraphPanel from '../components/GraphPanel'

export default function VisualizerPage({ result }) {
  const navigate = useNavigate()

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8 font-sans">
      <div className="space-y-2 border-b border-line pb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-nv">Dependency Visualizer</p>
        <h1 className="text-3xl font-black uppercase tracking-wider text-white">Dependency Graph</h1>
        <p className="text-mute text-xs uppercase tracking-wider font-mono">Interactive variable reference flow diagram and safety rules checks</p>
      </div>

      {!result ? (
        <div className="nv-panel p-12 text-center space-y-6 relative max-w-2xl mx-auto my-12">
          <div className="corner-square" />
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">No Active Telemetry Report</h2>
          <p className="text-xs text-mute uppercase tracking-wider max-w-sm mx-auto leading-relaxed">
            Please navigate to the Compiler Workspace, write or select a computational C++ kernel, and run the precision analysis pass.
          </p>
          <button
            onClick={() => navigate('/workspace')}
            className="btn-primary"
          >
            Open Workspace
          </button>
        </div>
      ) : (
        <div className="nv-panel overflow-hidden p-1 relative h-[610px]">
          <div className="corner-square" />
          <GraphPanel analysis={result} />
        </div>
      )}
    </div>
  )
}
