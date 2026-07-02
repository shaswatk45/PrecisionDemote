import { useEffect, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'
import MetricsPanel from '../components/MetricsPanel'
import GraphPanel from '../components/GraphPanel'
import CodeDiff from '../components/CodeDiff'
import NodeTable from '../components/NodeTable'

const DEMO_CODE = `float dot_product(float* a, float* b, int n) {
    float sum = 0.0f;
    for (int i = 0; i < n; i++) {
        float ai = a[i];
        float bi = b[i];
        float prod = ai * bi;
        sum += prod;
    }
    return sum;
}

float sigmoid_approx(float x) {
    float ex = x * 0.5f;
    float inv = 1.0f / (1.0f + ex);
    return inv;
}`

export default function AnalysisPage() {
  const [mode, setMode] = useState('text')
  const [code, setCode] = useState(DEMO_CODE)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [activeTab, setActiveTab] = useState('diff')
  const [health, setHealth] = useState(null)

  useEffect(() => {
    axios.get('/api/health')
      .then(({ data }) => setHealth(data))
      .catch(() => setHealth({ status: 'offline', mode: 'offline', toolReady: false }))
  }, [])

  const onDrop = useCallback(async (files) => {
    const f = files[0]
    if (!f) return
    const text = await f.text()
    setCode(text)
    setMode('text')
    toast.success(`Loaded ${f.name}`)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'] },
    maxFiles: 1,
    noClick: mode === 'text',
  })

  const analyze = async () => {
    if (!code.trim()) {
      toast.error('Please provide some code')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const { data } = await axios.post('/api/analyze-text', {
        code,
        filename: 'input.cpp',
      })
      setResult(data.analysis)
      setActiveTab('diff')
      toast.success('Analysis complete')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Backend error. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'diff', label: 'Code Diff' },
    { id: 'graph', label: 'Dependency Graph' },
    { id: 'nodes', label: 'Variable Table' },
    { id: 'metrics', label: 'Metrics' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">
            <span className="text-gradient">Analyze</span> Source Code
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Paste C/C++ code or upload a file, then inspect every demotion decision.
          </p>
        </div>
        <div className={`glass px-4 py-3 text-sm ${health?.status === 'offline' ? 'border-unsafe/40' : 'border-safe/30'}`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${health?.status === 'offline' ? 'bg-unsafe' : 'bg-safe animate-pulse-slow'}`} />
            <span className="text-gray-300">
              {health ? (health.toolReady ? 'Clang AST ready' : health.status === 'offline' ? 'Backend offline' : 'Fallback analyzer') : 'Checking backend...'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-6">
        <motion.div
          className="glass flex flex-col min-h-[460px] overflow-hidden"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-xs font-mono text-gray-400">input.cpp</span>
            <div className="flex gap-2">
              {['text', 'file'].map((nextMode) => (
                <button
                  key={nextMode}
                  className={`text-xs px-3 py-1 rounded-lg capitalize transition-all ${mode === nextMode ? 'bg-accent/20 text-accent' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => setMode(nextMode)}
                >
                  {nextMode === 'text' ? 'Edit' : 'Upload'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'text' ? (
            <textarea
              className="flex-1 bg-transparent font-mono text-sm text-gray-200 p-4 resize-none outline-none leading-relaxed placeholder:text-gray-600"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  if (!loading) analyze()
                }
              }}
              placeholder="Paste your C/C++ code here..."
              aria-label="C/C++ source code input"
              spellCheck={false}
            />
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
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.1 }}
        >
          <div className="glass p-5 space-y-3">
            <p className="section-title mb-2">Heuristic thresholds</p>
            {[
              { label: 'Max arithmetic depth', val: `<= ${health?.thresholds?.maxDepth ?? 3}` },
              { label: 'Division allowed', val: 'No' },
              { label: 'Max dependency fan-in', val: `<= ${health?.thresholds?.maxFanIn ?? 5}` },
              { label: 'Target type', val: 'plain float' },
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
              <>
                <div className="spinner w-5 h-5" />
                Analyzing...
              </>
            ) : (
              <>
                Run Precision Analysis
                <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-white/20 text-gray-300">Ctrl↵</kbd>
              </>
            )}
          </motion.button>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="glass p-5 space-y-2"
              >
                <p className="section-title mb-2">Summary</p>
                {result.functions.map(fn => {
                  const safeCount = fn.safeToDemote ?? fn.safeTodemote ?? 0
                  return (
                    <div key={fn.name} className="flex justify-between items-center text-sm">
                      <span className="font-mono text-gray-300">{fn.name}()</span>
                      <div className="flex gap-2">
                        <span className="tag-safe">{safeCount} safe</span>
                        <span className="tag-unsafe">{fn.totalFloatVars - safeCount} kept</span>
                      </div>
                    </div>
                  )
                })}
                <p className={`text-xs mt-2 ${result.mock ? 'text-warn/80' : 'text-safe/80'}`}>
                  {result.mock ? 'Fallback analyzer used' : 'Powered by Clang AST traversal'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex gap-2 flex-wrap">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === t.id ? 'bg-accent/20 text-accent border border-accent/40' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
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
