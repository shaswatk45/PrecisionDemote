import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Code, ShieldCheck, Cpu } from 'lucide-react'
import FeatureShowcase from '../components/FeatureShowcase'
import Preloader from '../components/Preloader'

const PIPELINE_STEPS = [
  { mark: '01', label: 'LOAD SOURCE', desc: 'Paste raw source code or upload target C/C++ files directly into the workspace.' },
  { mark: '02', label: 'PARSE AST', desc: 'RecursiveASTVisitor walks AST functions, identifying all FP32 VarDecls.' },
  { mark: '03', label: 'BUILD GRAPH', desc: 'Constructs a per-function dependency graph tracking operations and parameters.' },
  { mark: '04', label: 'SCORE SAFETY', desc: 'Evaluates heuristics including accumulator loops, fan-in, division, and bounds checks.' },
  { mark: '05', label: 'DETERMINE TARGET', desc: 'Assigns optimal types: __fp16, __bf16, or retains FP32 on precision hazards.' },
  { mark: '06', label: 'REWRITE SOURCE', desc: 'In-place clang::Rewriter updates type tokens while preserving formatting and comments.' },
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
const SAMPLE_VERDICTS = { 2: 'float (accumulator)', 4: '__fp16 (safe)', 5: '__fp16 (safe)', 6: '__fp16 (safe)' }
const REC_COLOR = { __fp16: '#76b900', float: '#f43f5e' }

function SelfAnalyzingCard() {
  const [reveal, setReveal] = useState(0)

  useEffect(() => {
    let line = 0
    let timer
    const advance = () => {
      line += 1
      if (line <= SAMPLE_LINES.length) {
        setReveal(line)
        timer = setTimeout(advance, 200)
      } else {
        timer = setTimeout(() => { line = 0; setReveal(0); timer = setTimeout(advance, 500) }, 3000)
      }
    }
    timer = setTimeout(advance, 800)
    return () => clearTimeout(timer)
  }, [])

  const scanning = reveal > 0 && reveal <= SAMPLE_LINES.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="nv-panel overflow-hidden relative font-sans"
    >
      <div className="corner-square" />
      <div className="border-b border-line px-4 py-3 flex items-center gap-2 bg-[#000000]">
        <span className="w-2 h-2 bg-nv rounded-full" />
        <span className="text-[11px] text-mute uppercase font-mono tracking-widest">Compiler Analyzer Output: dot_product.cpp</span>
        <span className="ml-auto font-mono text-[10px] uppercase text-nv tracking-widest">
          {scanning ? 'COMPILING AST…' : 'ANALYSIS STATIC'}
        </span>
      </div>

      <div className="relative bg-[#000000]">
        {scanning && (
          <div className="pd-scanline" style={{ top: `calc(${((reveal / SAMPLE_LINES.length) * 100).toFixed(1)}% - 12px)` }} />
        )}
        <pre className="code-block p-6 text-mute min-h-[260px] text-xs font-mono">
          {SAMPLE_LINES.map((text, i) => {
            const isFp16 = i === 3 || i === 4 || i === 5
            const isFloat = i === 1
            const showVerdict = i + 1 <= reveal
            let color = null
            if (showVerdict) {
              if (isFp16) color = '#76b900'
              if (isFloat) color = '#f43f5e'
            }

            return (
              <div
                key={i}
                className="px-2 -mx-2 rounded-none transition-colors duration-300"
                style={color ? { background: `${color}0c`, borderLeft: `2px solid ${color}` } : { borderLeft: '2px solid transparent' }}
              >
                {text || ' '}
                {showVerdict && (isFp16 || isFloat) && (
                  <span
                    className="ml-3 text-[10px] font-bold uppercase tracking-wider font-mono"
                    style={{ color }}
                  >
                    {isFp16 ? '→ __fp16' : '× Kept Float'}
                  </span>
                )}
              </div>
            )
          })}
        </pre>
      </div>

      <div className="grid grid-cols-3 text-center border-t border-line bg-[#000000]">
        {[
          ['03', 'DEMOTED VARS'],
          ['01', 'RETAINED VARS'],
          ['50%', 'STORAGE REDUCTION'],
        ].map(([value, label]) => (
          <div key={label} className="p-4 border-r border-line last:border-none">
            <div className="text-xl font-black text-white font-mono">{value}</div>
            <div className="text-[10px] text-stone uppercase tracking-widest mt-1 font-mono">{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function ScrollCard({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.4 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-20 font-sans">
      <Preloader />

      {/* Hero Section */}
      <section className="grid lg:grid-cols-[1.1fr_.9fr] gap-12 items-center min-h-[calc(100vh-12rem)] py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-nv">Static Code Analysis Framework</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-none text-white font-sans">
              Precision-Aware<br />
              Type Demotion
            </h1>
            <p className="text-sm text-mute max-w-xl leading-relaxed uppercase tracking-wider font-mono">
              FP32 TO FP16 / BF16 COMPILER-GRADE OPTIMIZATION PASS
            </p>
          </div>

          <p className="text-sm text-body max-w-xl leading-relaxed">
            Automate variables demotion in computational kernels safely. 
            PrecisionDemote inspects the C/C++ AST hierarchy, evaluates numerical risk, 
            quantifies maximum fan-in and deep division chains, and rewrites source code in place.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <button
              className="btn-primary"
              onClick={() => navigate('/analysis')}
            >
              Analyze C/C++ Source
            </button>
            <a href="#pipeline" className="btn-outline-dark text-xs flex items-center py-2.5 px-6">
              View Pipeline
            </a>
          </div>
        </motion.div>

        <div className="relative">
          <SelfAnalyzingCard />
        </div>
      </section>

      {/* Feature Showcase */}
      <FeatureShowcase />

      {/* Stats Section */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { val: '06',       label: 'Heuristic Rules' },
          { val: '0-100',    label: 'Safety Score' },
          { val: 'FP16/BF16',label: 'Targets Supported' },
          { val: 'SARIF 2.1',label: 'Standard Output' },
        ].map(({ val, label }, i) => (
          <ScrollCard key={label} delay={i * 0.05} className="nv-panel p-6 relative">
            <div className="corner-square" />
            <div className="text-2xl font-black text-white font-mono">{val}</div>
            <div className="text-[11px] text-mute uppercase tracking-wider mt-1">{label}</div>
          </ScrollCard>
        ))}
      </section>

      {/* Pipeline Section */}
      <section id="pipeline" className="space-y-8 py-8 border-t border-line">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-nv">Static Analysis Sequence</p>
          <h2 className="text-2xl font-black uppercase tracking-wider text-white">Execution Pipeline</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PIPELINE_STEPS.map((step, i) => (
            <ScrollCard key={step.label} delay={i * 0.04} className="nv-panel-hover p-6 relative group cursor-default">
              <div className="corner-square opacity-40 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="font-mono text-xs rounded-none px-2 py-0.5 font-bold bg-[#1a1a1a] border border-line text-nv"
                >
                  {step.mark}
                </span>
                <span className="font-bold text-xs uppercase tracking-wider text-white">{step.label}</span>
              </div>
              <p className="text-xs text-body leading-relaxed">{step.desc}</p>
            </ScrollCard>
          ))}
        </div>
      </section>

      {/* Safe / Retained Logic */}
      <section className="grid md:grid-cols-2 gap-6 py-8 border-t border-line">
        {[
          {
            title: 'SAFE DEMOTION PATHWAY',
            text: 'Variables with shallow arithmetic chain depth, no constant updates exceeding range bounds (±65504), no division operations, and low overall fan-in are safely compiled down to ARM/half __fp16 or __bf16 targets.',
            border: '#2a2a2a',
          },
          {
            title: 'RETAINED FP32 PATHWAY',
            text: 'Deep expression chains, division statements, accumulator patterns (e.g., sum updates inside loops), and potential numeric overflow zones are preserved at float level, each backed by explicit compiler pass diagnostics.',
            border: '#2a2a2a',
          },
        ].map(({ title, text, border }, i) => (
          <ScrollCard key={title} delay={i * 0.05}>
            <div
              className="nv-panel p-6 h-full relative"
              style={{ borderColor: border }}
            >
              <div className="corner-square opacity-60" />
              <p className="text-xs font-bold uppercase tracking-wider text-nv mb-3">{title}</p>
              <p className="text-xs text-body leading-relaxed">{text}</p>
            </div>
          </ScrollCard>
        ))}
      </section>
    </div>
  )
}
