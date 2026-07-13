import { useState, useCallback, useRef, useEffect, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import HomePage from './pages/HomePage'
import WorkspacePage from './pages/WorkspacePage'
import VisualizerPage from './pages/VisualizerPage'
import MetricsPage from './pages/MetricsPage'
import SimulatorPage from './pages/SimulatorPage'
import DocsPage from './pages/DocsPage'
import SlidesPage from './pages/SlidesPage'
import { fallbackAnalysis, computeMetrics, EXAMPLES } from './lib/analyzer'


const DEMO_CODE = `float dot_product(float* a, float* b, int n) {
    float sum = 0.0f;
    for (int i = 0; i < n; i++) {
        float ai   = a[i];
        float bi   = b[i];
        float prod = ai * bi;
        sum += prod;
    }
    return sum;
}`

export default function App() {
  const [code, setCode] = useState(DEMO_CODE)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [health, setHealth] = useState(null)
  const [examples, setExamples] = useState([])
  const [presenting, setPresenting] = useState(false)
  const [maxDepth, setMaxDepth] = useState(3)
  const [maxFanIn, setMaxFanIn] = useState(5)
  const autoRanRef = useRef(false)

  useEffect(() => {
    axios.get('/api/health')
      .then(({ data }) => {
        setHealth(data)
        if (data?.thresholds) {
          setMaxDepth(data.thresholds.maxDepth ?? 3)
          setMaxFanIn(data.thresholds.maxFanIn ?? 5)
        }
      })
      .catch(() => setHealth({ status: 'offline', mode: 'offline', toolReady: false }))
    axios.get('/api/examples')
      .then(({ data }) => setExamples(data.examples || []))
      .catch(() => {
        console.warn('Backend unavailable, loading examples locally')
        setExamples(EXAMPLES)
      })
  }, [])

  const analyze = useCallback(async (opts = {}) => {
    if (!code.trim()) { toast.error('Please provide some code'); return }
    setLoading(true)
    setResult(null)
    try {
      const { data } = await axios.post('/api/analyze-text', {
        code,
        filename: 'input.cpp',
        thresholds: { maxDepth, maxFanIn }
      })
      setResult(data.analysis)
      if (!opts.silent) toast.success('Analysis complete')
    } catch (err) {
      console.warn('Backend unavailable, running analysis locally in browser:', err)
      try {
        const localResult = fallbackAnalysis(code, 'input.cpp', { maxDepth, maxFanIn })
        localResult.metrics = computeMetrics(localResult)
        setResult(localResult)
        if (!opts.silent) toast.success('Analysis complete (local browser-side)')
      } catch (localErr) {
        console.error('Local analyzer failed:', localErr)
        const rawError = err.response?.data?.error
        const errorMsg = typeof rawError === 'object' && rawError
          ? (rawError.message || JSON.stringify(rawError))
          : (rawError || err.message || 'Backend error. Is the server running?')
        toast.error(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }, [code, maxDepth, maxFanIn])

  const analyzeRef = useRef(analyze)
  analyzeRef.current = analyze

  useEffect(() => {
    const t = setTimeout(() => {
      if (autoRanRef.current) return
      autoRanRef.current = true
      analyzeRef.current({ silent: true })
    }, 900)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar />
      <main className="flex-1">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/workspace" element={
              <WorkspacePage
                code={code}
                setCode={setCode}
                result={result}
                setResult={setResult}
                maxDepth={maxDepth}
                setMaxDepth={setMaxDepth}
                maxFanIn={maxFanIn}
                setMaxFanIn={setMaxFanIn}
                loading={loading}
                setLoading={setLoading}
                health={health}
                examples={examples}
                presenting={presenting}
                setPresenting={setPresenting}
                analyze={analyze}
              />
            } />
            <Route path="/visualizer" element={<VisualizerPage result={result} />} />
            <Route path="/metrics" element={<MetricsPage result={result} />} />
            <Route path="/simulator" element={<SimulatorPage code={code} />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/ppt" element={<SlidesPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}
