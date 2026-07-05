import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import FeatureShowcase from '../components/FeatureShowcase'
import Preloader from '../components/Preloader'

const PIPELINE_STEPS = [
  { mark: '01', label: 'Load source', desc: 'Paste code or upload a C/C++ file' },
  { mark: '02', label: 'Parse AST', desc: 'Clang walks functions and declarations' },
  { mark: '03', label: 'Build graph', desc: 'Float dependencies are connected' },
  { mark: '04', label: 'Score safety', desc: 'Depth, division, fan-in, accumulator, range checks' },
  { mark: '05', label: 'Rewrite', desc: 'Safe declarations become __fp16 / __bf16' },
  { mark: '06', label: 'Inspect', desc: 'Review diff, graph, table, and metrics' },
]

const SAMPLE_LINES = [
  'float dot_product(float* a, float* b, int n) {',
  '    float sum = 0.0f;',
  '    for (int i = 0; i < n; i++) {',
  '        float ai   = a[i];',
  '        float bi   = b[i];',
  '        float prod = ai * bi;',
  '        sum += prod;',
  '    }',
  '    return sum;',
  '}',
]
// Verdicts for the self-analyzing hero card (1-based line → target).
const SAMPLE_VERDICTS = { 2: 'float', 4: '__fp16', 5: '__fp16', 6: '__fp16' }
const REC_COLOR = { __fp16: '#14b8a6', __bf16: '#f59e0b', float: '#f43f5e' }

/** Looping FP32 → __fp16 / __bf16 morph pill. */
function TypeMorph() {
  const targets = [
    { text: '__fp16', color: '#14b8a6' },
    { text: '__bf16', color: '#f59e0b' },
  ]
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % targets.length), 2200)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const t = targets[i]
  return (
    <span className="inline-flex items-center gap-2 font-mono">
      <span className="text-gray-300">FP32</span>
      <ArrowRight className="w-4 h-4 text-accent-light" />
      <span className="relative inline-block w-[72px] text-left">
        <motion.span
          key={t.text}
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.35 }}
          className="inline-block font-bold"
          style={{ color: t.color, textShadow: `0 0 14px ${t.color}66` }}
        >
          {t.text}
        </motion.span>
      </span>
    </span>
  )
}

/** Per-word masked reveal for the hero headline. */
function KineticHeadline() {
  const rows = [
    { words: ['Precision-Aware'], cls: 'text-white' },
    { words: ['Mixed-Precision', 'Demotion'], cls: 'text-gradient' },
  ]
  let idx = 0
  return (
    <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
      {rows.map((row, r) => (
        <span key={r} className="block">
          {row.words.map((w) => {
            const delay = 0.15 + idx++ * 0.14
            return (
              <span key={w} className="inline-block overflow-hidden align-bottom mr-[0.28em] last:mr-0">
                <motion.span
                  className={`inline-block ${row.cls}`}
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w}
                </motion.span>
              </span>
            )
          })}
        </span>
      ))}
    </h1>
  )
}

/** The hero code card analyses itself on a loop — scanline + line ignition. */
function SelfAnalyzingCard() {
  const [reveal, setReveal] = useState(0) // 0..SAMPLE_LINES.length, cycles

  useEffect(() => {
    let line = 0
    let timer
    const advance = () => {
      line += 1
      if (line <= SAMPLE_LINES.length) {
        setReveal(line)
        timer = setTimeout(advance, 240)
      } else {
        // hold the fully-analysed state, then restart
        timer = setTimeout(() => { line = 0; setReveal(0); timer = setTimeout(advance, 500) }, 2600)
      }
    }
    timer = setTimeout(advance, 900)
    return () => clearTimeout(timer)
  }, [])

  const scanning = reveal > 0 && reveal <= SAMPLE_LINES.length

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.35 }}
      className="glass hud-corners overflow-hidden shadow-glow-accent animate-float relative"
    >
      <div className="relative overflow-hidden border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-unsafe/80" />
        <span className="w-3 h-3 rounded-full bg-warn/80" />
        <span className="w-3 h-3 rounded-full bg-safe/80" />
        <span className="ml-3 text-xs text-gray-500 font-mono">dot_product.cpp</span>
        <span className="ml-auto font-mono text-[10px] text-accent-light/80">
          {scanning ? 'analyzing…' : 'analyzed'}
        </span>
      </div>

      <div className="relative">
        {scanning && (
          <div className="pd-scanline" style={{ top: `calc(${((reveal / SAMPLE_LINES.length) * 100).toFixed(1)}% - 22px)` }} />
        )}
        <pre className="code-block p-6 text-gray-400 bg-surface-900/50 min-h-[300px] text-[13px]">
          {SAMPLE_LINES.map((text, i) => {
            const verdict = i + 1 <= reveal ? SAMPLE_VERDICTS[i + 1] : null
            const col = verdict ? REC_COLOR[verdict] : null
            return (
              <div
                key={i}
                className="px-2 -mx-2 rounded transition-colors duration-500"
                style={col ? { background: `${col}1c`, borderLeft: `2px solid ${col}` } : { borderLeft: '2px solid transparent' }}
              >
                {text || ' '}
                {verdict && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="ml-2 text-[10px] font-bold font-mono"
                    style={{ color: col }}
                  >
                    {verdict === 'float' ? '× kept' : `→ ${verdict}`}
                  </motion.span>
                )}
              </div>
            )
          })}
        </pre>
      </div>

      <div className="grid grid-cols-3 border-t border-white/10 text-center">
        {[
          ['3', '→ __fp16'],
          ['1', 'kept float'],
          ['50%', 'storage cut'],
        ].map(([value, label]) => (
          <div key={label} className="p-4 border-r last:border-r-0 border-white/10">
            <div className="text-2xl font-extrabold text-gradient">{value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
      <Preloader />

      <section className="grid lg:grid-cols-[1.05fr_.95fr] gap-10 items-center min-h-[calc(100vh-9rem)]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-7"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-safe/10 border border-safe/30 text-safe text-sm font-medium"
          >
            <span className="w-2 h-2 rounded-full bg-safe animate-pulse-slow" />
            Clang AST mixed-precision analysis
            <span className="text-gray-600">·</span>
            <TypeMorph />
          </motion.div>

          <div className="space-y-5">
            <KineticHeadline />
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="text-lg text-gray-400 max-w-2xl"
            >
              Statically analyze numerical C/C++ kernels, score every float variable for
              demotion safety, quantify the FP16/BF16 rounding error, and rewrite to the
              optimal narrow type — all inspectable before you accept a single change.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
            className="flex flex-wrap gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary text-base px-8 py-3.5"
              onClick={() => navigate('/analysis')}
            >
              Analyze code
            </motion.button>
            <a href="#features" className="btn-ghost text-base px-8 py-3.5">
              See what it does
            </a>
          </motion.div>
        </motion.div>

        <SelfAnalyzingCard />
      </section>

      <FeatureShowcase />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { val: '6', label: 'safety rules' },
          { val: '0-100', label: 'per-var score' },
          { val: 'FP16/BF16', label: 'mixed targets' },
          { val: 'SARIF', label: 'export format' },
        ].map(({ val, label }, i) => (
          <motion.div
            key={label}
            className="glass p-5"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ scale: 1.05, y: -5 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 120 }}
          >
            <div className="text-3xl font-extrabold text-gradient">{val}</div>
            <div className="text-sm text-gray-400">{label}</div>
          </motion.div>
        ))}
      </section>

      <section id="pipeline" className="space-y-8">
        <div>
          <p className="section-title">Pipeline</p>
          <h2 className="text-3xl font-bold">From source to decision trace</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PIPELINE_STEPS.map((step, i) => (
            <motion.div
              key={step.label}
              className="glass-hover p-5"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ scale: 1.03, y: -2 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 100 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-safe text-xs border border-safe/30 rounded px-2 py-1">{step.mark}</span>
                <span className="font-semibold text-white">{step.label}</span>
              </div>
              <p className="text-sm text-gray-400">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        {[
          ['Safe path', 'Plain float variables with shallow arithmetic, no division, low fan-in, in-range values, and no accumulator updates are demoted to __fp16 — or __bf16 when only FP16 range fails.'],
          ['Blocked path', 'Division chains, deep expression trees, accumulator targets, and unsupported types stay at FP32 — each with the exact rule that blocked them.'],
        ].map(([title, text], i) => (
          <motion.div
            key={title}
            className={`glass p-6 border ${i === 0 ? 'border-safe/25' : 'border-unsafe/25'}`}
            whileHover={{ y: -4 }}
          >
            <p className="section-title">{title}</p>
            <p className="text-gray-300 leading-relaxed">{text}</p>
          </motion.div>
        ))}
      </section>
    </div>
  )
}
