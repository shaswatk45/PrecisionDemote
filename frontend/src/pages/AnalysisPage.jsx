import { useEffect, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'
import MetricsPanel from '../components/MetricsPanel'
import GraphPanel from '../components/GraphPanel'
import CodeDiff from '../components/CodeDiff'
import NodeTable from '../components/NodeTable'
import CodeEditor from '../components/CodeEditor'
import ExportMenu from '../components/ExportMenu'
import ExamplesGallery from '../components/ExamplesGallery'

const DEMO_CODE = `float dot_product(float* a, float* b, int n) {
    float sum = 0.0f;
    for (int i = 0; i < n; i++) {
        float ai   = a[i];
        float bi   = b[i];
        float prod = ai * bi;
        sum += prod;
    }
    return sum;
}

float sigmoid_approx(float x) {
    float ex  = x * 0.5f;
    float inv = 1.0f / (1.0f + ex);
    return inv;
}`

export default function AnalysisPage() {
  const [mode, setMode] = useState('edit')
  const [code, setCode] = useState(DEMO_CODE)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [activeTab, setActiveTab] = useState('annotated')
  const [health, setHealth] = useState(null)
  const [examples, setExamples] = useState([])

  useEffect(() => {
    axios.get('/api/health')
      .then(({ data }) => setHealth(data))
      .catch(() => setHealth({ status: 'offline', mode: 'offline', toolReady: false }))
    axios.get('/api/examples')
      .then(({ data }) => setExamples(data.examples || []))
      .catch(() => {})
  }, [])

  const onDrop = useCallback(async (files) => {
    const f = files[0]
    if (!f) return
    const text = await f.text()
    setCode(text)
    setMode('edit')
    toast.success(`Loaded ${f.name}`)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'] },
    maxFiles: 1,
    noClick: mode === 'edit',
  })

  const analyze = useCallback(async () => {
    if (!code.trim()) { toast.error('Please provide some code'); return }
    setLoading(true)
    setResult(null)
    try {
      const { data } = await axios.post('/api/analyze-text', { code, filename: 'input.cpp' })
      setResult(data.analysis)
      setActiveTab('annotated')
      toast.success('Analysis complete')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Backend error. Is the server running?')
    } finally {
      setLoading(false)
    }
  }, [code])

  const allNodes = result ? result.functions.flatMap(f => f.nodes) : []
  const m = result?.metrics

  const tabs = [
    { id: 'annotated', label: 'Annotated Source' },
    { id: 'diff', label: 'Diff' },
    { id: 'graph', label: 'Dependency Graph' },
    { id: 'nodes', label: 'Variable Table' },
    { id: 'metrics', label: 'Metrics' },
  ]

  const engineLabel = !health ? 'Checking backend…'
    : health.status === 'offline' ? 'Backend offline'
    : health.toolReady ? 'Clang AST engine' : 'JS fallback engine'

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">
            <span className="text-gradient">Analyze</span> Source Code
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Edit C/C++ in the IDE below, then inspect every mixed-precision decision — score, target type, and error bound.
          </p>
        </div>
        <div className={`glass px-4 py-3 text-sm ${health?.status === 'offline' ? 'border-unsafe/40' : 'border-safe/30'}`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${health?.status === 'offline' ? 'bg-unsafe' : 'bg-safe animate-pulse-slow'}`} />
            <span className="text-gray-300">{engineLabel}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.25fr_.75fr] gap-6">
        <motion.div
          className="glass flex flex-col min-h-[480px] overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-xs font-mono text-gray-400">input.cpp</span>
            <div className="flex gap-2">
              {['edit', 'upload'].map((nextMode) => (
                <button
                  key={nextMode}
                  className={`text-xs px-3 py-1 rounded-lg capitalize transition-all ${mode === nextMode ? 'bg-accent/20 text-accent' : 'text-gray-400 hover:text-white'}`}
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
              className={`flex-1 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 m-4 rounded-lg border-2 border-dashed ${isDragActive ? 'border-accent bg-accent/10' : 'border-white/20 hover:border-accent/50'}`}
            >
              <input {...getInputProps()} />
              <div className="text-sm font-medium text-gray-300">
                {isDragActive ? 'Drop the file' : 'Drop a C/C++ source file here'}
              </div>
              <p className="text-xs text-gray-500 mt-1">or click to browse</p>
            </div>
          )}
        </motion.div>

        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.1 }}
        >
          <ExamplesGallery examples={examples} onPick={(c) => { setCode(c); setMode('edit') }} />

          <div className="glass p-5 space-y-3">
            <p className="section-title mb-2">Heuristic thresholds</p>
            {[
              { label: 'Max arithmetic depth', val: `≤ ${health?.thresholds?.maxDepth ?? 3}` },
              { label: 'Max dependency fan-in', val: `≤ ${health?.thresholds?.maxFanIn ?? 5}` },
              { label: 'FP16 range limit', val: '±65504' },
              { label: 'Targets', val: '__fp16 · __bf16' },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-400">{label}</span>
                <span className="font-mono text-safe">{val}</span>
              </div>
            ))}
          </div>

          <motion.button
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-3 relative overflow-hidden"
            onClick={analyze}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading && <span className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-scan" />}
            {loading ? (
              <><div className="spinner w-5 h-5" /> Analyzing…</>
            ) : (
              <>Run Precision Analysis <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-white/20 text-gray-300">Ctrl↵</kbd></>
            )}
          </motion.button>

          <AnimatePresence>
            {result && m && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass p-5 space-y-3"
              >
                <p className="section-title mb-2">Summary</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ['__fp16', m.fp16Count, 'text-safe'],
                    ['__bf16', m.bf16Count, 'text-warn'],
                    ['kept', m.keptFloatCount, 'text-unsafe'],
                  ].map(([label, val, color]) => (
                    <div key={label} className="bg-white/5 rounded-lg py-2">
                      <div className={`text-2xl font-extrabold ${color}`}>{val}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 pt-1">
                  <span>≈ {m.estimatedSpeedup}× speedup</span>
                  <span>{m.bytesSaved} B saved</span>
                  <span>score {m.avgSafetyScore}</span>
                </div>
                <p className={`text-xs ${result.engine === 'fallback-js' ? 'text-warn/80' : 'text-safe/80'}`}>
                  {result.engine === 'fallback-js' ? 'JS fallback analyzer' : `Clang AST · tool v${result.toolVersion || '3.0'}`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex gap-2 flex-wrap items-center">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === t.id ? 'bg-accent/20 text-accent border border-accent/40' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  {t.label}
                </button>
              ))}
              <div className="ml-auto"><ExportMenu analysis={result} code={code} /></div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'annotated' && (
                  <div className="glass overflow-hidden">
                    <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10 flex-wrap text-xs">
                      <span className="font-semibold text-gray-400 uppercase tracking-wider">Annotated Source</span>
                      <span className="flex items-center gap-1.5 text-gray-400"><span className="w-3 h-1.5 rounded bg-safe" /> __fp16</span>
                      <span className="flex items-center gap-1.5 text-gray-400"><span className="w-3 h-1.5 rounded bg-warn" /> __bf16</span>
                      <span className="flex items-center gap-1.5 text-gray-400"><span className="w-3 h-1.5 rounded bg-unsafe" /> kept float</span>
                      <span className="ml-auto text-gray-500">hover a highlighted line for details</span>
                    </div>
                    <CodeEditor value={result.originalSource} readOnly nodes={allNodes} height={560} />
                  </div>
                )}
                {activeTab === 'diff' && <CodeDiff original={result.originalSource} rewritten={result.rewrittenSource} />}
                {activeTab === 'graph' && <GraphPanel analysis={result} />}
                {activeTab === 'nodes' && <NodeTable analysis={result} />}
                {activeTab === 'metrics' && <MetricsPanel metrics={result.metrics} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
