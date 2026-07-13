import { useState, useMemo, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { MonitorPlay } from 'lucide-react'
import CodeDiff from '../components/CodeDiff'
import NodeTable from '../components/NodeTable'
import CodeEditor from '../components/CodeEditor'
import ExportMenu from '../components/ExportMenu'
import ExamplesGallery from '../components/ExamplesGallery'
import RiskSkyline from '../components/RiskSkyline'
import PresenterMode from '../components/PresenterMode'
import CountUp from '../components/CountUp'
import useScanReveal from '../lib/useScanReveal'

const TAB_VARIANTS = {
  initial: { opacity: 0, x: 28, filter: 'blur(6px)' },
  animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
}

function AnnotatedSource({ source, nodes, totalLines }) {
  const editorRef = useRef(null)
  const { visibleNodes, progress, scanning } = useScanReveal(nodes, { duration: 1900 })

  return (
    <div className="nv-panel hud-corners overflow-hidden bg-black">
      <div className="flex items-center gap-4 px-4 py-3 flex-wrap text-xs uppercase font-bold tracking-wider"
        style={{ borderBottom: '1px solid #2a2a2a' }}>
        <span className="text-nv">Annotated Source</span>
        <span className="flex items-center gap-1.5 text-mute"><span className="w-3 h-1.5 rounded-sm bg-safe" /> __fp16</span>
        <span className="flex items-center gap-1.5 text-mute"><span className="w-3 h-1.5 rounded-sm bg-warn" /> __bf16</span>
        <span className="flex items-center gap-1.5 text-mute"><span className="w-3 h-1.5 rounded-sm bg-unsafe" /> kept float</span>
        <span className="ml-auto text-stone font-mono lowercase font-normal">
          {scanning ? 'compiler pass…' : 'hover a highlighted line for safety reasoning'}
        </span>
      </div>
      <div className="flex gap-2 p-2">
        <RiskSkyline nodes={nodes} totalLines={totalLines} editorRef={editorRef} height={560} />
        <div className="flex-1 min-w-0">
          <CodeEditor
            value={source}
            readOnly
            nodes={visibleNodes}
            height={560}
            scanProgress={scanning ? progress : null}
            onEditorMount={(ed) => { editorRef.current = ed }}
          />
        </div>
      </div>
    </div>
  )
}

export default function WorkspacePage({
  code, setCode, result, setResult, maxDepth, setMaxDepth, maxFanIn, setMaxFanIn,
  loading, setLoading, health, examples, presenting, setPresenting, analyze
}) {
  const [mode, setMode] = useState('edit')
  const [activeTab, setActiveTab] = useState('annotated')

  const onDrop = async (files) => {
    const f = files[0]
    if (!f) return
    const text = await f.text()
    setCode(text)
    setMode('edit')
    toast.success(`Loaded ${f.name}`)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'] },
    maxFiles: 1,
    noClick: mode === 'edit',
  })

  const allNodes = useMemo(
    () => (result ? result.functions.flatMap(f => f.nodes) : []),
    [result]
  )
  const totalLines = useMemo(
    () => (result?.originalSource ? result.originalSource.split('\n').length : 1),
    [result]
  )

  const m = result?.metrics

  const tabs = [
    { id: 'annotated', label: 'Annotated Source' },
    { id: 'diff',      label: 'Diff Comparison' },
    { id: 'nodes',     label: 'Variable Table' },
  ]

  const engine = !health ? 'boot'
    : health.status === 'offline' ? 'offline'
    : health.toolReady ? 'clang' : 'fallback'
  const engineMeta = {
    boot:     { color: '#6b7280', label: 'LINKING…' },
    offline:  { color: '#f59e0b', label: 'BROWSER-FALLBACK · ONLINE' },
    clang:    { color: '#76b900', label: 'CLANG-AST · ONLINE' },
    fallback: { color: '#f59e0b', label: 'JS-FALLBACK · ONLINE' },
  }[engine]

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-nv">Compilation & Analysis</p>
          <h1 className="text-3xl font-black uppercase tracking-wider text-white">Compiler Workspace</h1>
          <p className="text-mute text-xs uppercase tracking-wider font-mono">
            INPUT C/C++ TO RUN COMPILER PASS OPTIMIZATION ANALYSIS
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="nv-panel hud-scanlines px-4 py-2.5 flex items-center gap-2.5 bg-black">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: engineMeta.color }}
            />
            <span className="font-mono text-[11px] tracking-widest uppercase font-bold" style={{ color: engineMeta.color }}>
              {engineMeta.label}
            </span>
          </div>

          <button
            onClick={() => setPresenting(true)}
            className="btn-primary text-xs px-4 py-2.5 flex items-center gap-2"
            title="Auto-playing walkthrough — space to advance, Esc to exit"
          >
            <MonitorPlay className="w-4 h-4" /> Present
          </button>
        </div>
      </div>

      {/* Editor + Sidebar */}
      <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-6">
        <motion.div
          className="nv-panel hud-corners flex flex-col min-h-[480px] overflow-hidden bg-black"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid #2a2a2a' }}>
            <span className="text-xs font-mono text-mute uppercase tracking-widest font-bold">input.cpp</span>
            <div className="flex gap-2">
              {['edit', 'upload'].map((nextMode) => (
                <button
                  key={nextMode}
                  className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-sm transition-all ${
                    mode === nextMode
                      ? 'text-black bg-nv'
                      : 'text-mute hover:text-white'
                  }`}
                  onClick={() => setMode(nextMode)}
                >
                  {nextMode}
                </button>
              ))}
            </div>
          </div>

          {mode === 'edit' ? (
            <div className="min-h-[440px]">
              <CodeEditor value={code} onChange={setCode} onRun={analyze} height={456} />
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`flex-1 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 m-4 rounded-sm border border-dashed ${
                isDragActive
                  ? 'border-nv bg-nv/5'
                  : 'border-line hover:border-nv/50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="text-xs font-bold uppercase tracking-wider text-ink">
                {isDragActive ? 'Drop the file' : 'Drop a C/C++ source file here'}
              </div>
              <p className="text-[10px] text-mute mt-1 uppercase tracking-wider">or click to browse</p>
            </div>
          )}
        </motion.div>

        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <ExamplesGallery examples={examples} onPick={(c) => { setCode(c); setMode('edit') }} />

          <div className="nv-panel p-5 space-y-4 relative bg-black">
            <div className="corner-square opacity-60" />
            <p className="text-xs font-bold uppercase tracking-widest text-nv mb-1">Analysis Thresholds</p>

            <div className="space-y-1">
              <div className="flex justify-between text-xs uppercase tracking-wide">
                <span className="text-mute">Max arithmetic depth</span>
                <span className="font-mono text-nv font-bold">≤ {maxDepth}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                className="w-full h-1 bg-[#1a1a1a] rounded-sm appearance-none cursor-pointer accent-nv"
                style={{ accentColor: '#76b900' }}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs uppercase tracking-wide">
                <span className="text-mute">Max dependency fan-in</span>
                <span className="font-mono text-nv font-bold">≤ {maxFanIn}</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                value={maxFanIn}
                onChange={(e) => setMaxFanIn(Number(e.target.value))}
                className="w-full h-1 bg-[#1a1a1a] rounded-sm appearance-none cursor-pointer accent-nv"
                style={{ accentColor: '#76b900' }}
              />
            </div>

            <div className="border-t border-line pt-3 space-y-2">
              {[
                { label: 'FP16 range limit',      val: '±65504' },
                { label: 'Targets',               val: '__fp16 · __bf16' },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between text-xs uppercase tracking-wide">
                  <span className="text-mute">{label}</span>
                  <span className="font-mono text-nv font-bold">{val}</span>
                </div>
              ))}
            </div>
          </div>

          <motion.button
            className="btn-primary w-full py-4 text-xs font-bold tracking-wider flex items-center justify-center gap-3 relative overflow-hidden"
            onClick={() => analyze()}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {loading && <span className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-scan" />}
            {loading ? (
              <><div className="spinner w-4 h-4" /> Analyzing…</>
            ) : (
              <>Run Precision Analysis <kbd className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-black/40 border border-line text-mute">Ctrl↵</kbd></>
            )}
          </motion.button>

          {result && m && (
            <motion.div
              key={`summary-${result.jobId || m.totalFloatVars}-${m.fp16Count}`}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="nv-panel hud-corners p-5 space-y-3 bg-black"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-nv mb-2">Summary</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['__fp16', m.fp16Count,       'text-safe'],
                  ['__bf16', m.bf16Count,       'text-warn'],
                  ['kept',   m.keptFloatCount,  'text-unsafe'],
                ].map(([label, val, color]) => (
                  <div key={label} className="rounded-sm py-2 bg-surface-elevated/40 border border-line">
                    <div className={`text-xl font-black font-mono ${color}`}>
                      <CountUp value={val} duration={800} />
                    </div>
                    <div className="text-[10px] text-mute font-mono uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-mute pt-1 font-mono uppercase tracking-wider">
                <span>≈ <CountUp value={m.estimatedSpeedup} decimals={2} duration={900} />× speedup</span>
                <span><CountUp value={m.bytesSaved} duration={900} /> B saved</span>
                <span>score <CountUp value={m.avgSafetyScore} duration={900} /></span>
              </div>
              <p className={`text-[10px] uppercase font-bold tracking-wider ${result.engine === 'fallback-js' ? 'text-warn/80' : 'text-nv/80'}`}>
                {result.engine === 'fallback-js' ? 'JS fallback analyzer' : `Clang AST · tool v${result.toolVersion || '3.0'}`}
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Results tabs */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex gap-2 flex-wrap items-center">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`relative px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors duration-200 ${
                  activeTab === t.id ? 'text-white' : 'text-mute hover:text-white hover:bg-white/5'
                }`}
              >
                {activeTab === t.id && (
                  <motion.span
                    layoutId="pd-tab-pill"
                    className="absolute inset-0 rounded-sm"
                    style={{
                      background: 'rgba(118, 185, 0, 0.12)',
                      border: '1px solid #76b900',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
            <div className="ml-auto"><ExportMenu analysis={result} code={code} /></div>
          </div>

          <motion.div
            key={activeTab}
            variants={TAB_VARIANTS}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            {activeTab === 'annotated' && (
              <AnnotatedSource source={result.originalSource} nodes={allNodes} totalLines={totalLines} />
            )}
            {activeTab === 'diff'      && <CodeDiff original={result.originalSource} rewritten={result.rewrittenSource} />}
            {activeTab === 'nodes'     && <NodeTable analysis={result} />}
          </motion.div>
        </motion.div>
      )}

      {presenting && (
        <PresenterMode
          analysis={result}
          code={code}
          onClose={() => setPresenting(false)}
        />
      )}
    </div>
  )
}
