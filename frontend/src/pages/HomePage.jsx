import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import FeatureShowcase from '../components/FeatureShowcase'

const PIPELINE_STEPS = [
  { mark: '01', label: 'Load source', desc: 'Paste code or upload a C/C++ file' },
  { mark: '02', label: 'Parse AST', desc: 'Clang walks functions and declarations' },
  { mark: '03', label: 'Build graph', desc: 'Float dependencies are connected' },
  { mark: '04', label: 'Score safety', desc: 'Depth, division, fan-in, accumulator checks' },
  { mark: '05', label: 'Rewrite', desc: 'Safe declarations become __fp16' },
  { mark: '06', label: 'Inspect', desc: 'Review diff, graph, table, and metrics' },
]

const SAMPLE_CODE = `float dot_product(float* a, float* b, int n) {
    float sum = 0.0f;
    for (int i = 0; i < n; i++) {
        float ai = a[i];
        float bi = b[i];
        float prod = ai * bi;
        sum += prod;
    }
    return sum;
}`

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
      <section className="grid lg:grid-cols-[1.05fr_.95fr] gap-10 items-center min-h-[calc(100vh-9rem)]">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="space-y-7"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-safe/10 border border-safe/30 text-safe text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-safe animate-pulse-slow" />
            Clang AST mixed-precision analysis · FP32 → FP16 / BF16
          </div>

          <div className="space-y-5">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
              Precision-Aware
              <span className="block text-gradient">Mixed-Precision Demotion</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl">
              Statically analyze numerical C/C++ kernels, score every float variable for
              demotion safety, quantify the FP16/BF16 rounding error, and rewrite to the
              optimal narrow type — all inspectable before you accept a single change.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary text-base px-8 py-3.5"
              onClick={() => navigate('/analysis')}
            >
              Analyze code
            </motion.button>
            <a href="#pipeline" className="btn-ghost text-base px-8 py-3.5">
              View pipeline
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotateX: 5 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.2 }}
          className="glass overflow-hidden shadow-glow-accent animate-float"
          style={{ perspective: 1000 }}
        >
          <div className="relative overflow-hidden border-b border-white/10 px-4 py-3 flex items-center gap-3">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-safe/10 to-transparent animate-scan" />
            <span className="w-3 h-3 rounded-full bg-unsafe/80" />
            <span className="w-3 h-3 rounded-full bg-warn/80" />
            <span className="w-3 h-3 rounded-full bg-safe/80" />
            <span className="ml-3 text-xs text-gray-500 font-mono">dot_product.cpp</span>
          </div>
          <pre className="code-block p-6 text-gray-300 bg-surface-900/50 min-h-[310px]">
            <code>{SAMPLE_CODE}</code>
          </pre>
          <div className="grid grid-cols-3 border-t border-white/10 text-center">
            {[
              ['3', 'demoted'],
              ['1', 'kept'],
              ['50%', 'storage cut'],
            ].map(([value, label]) => (
              <div key={label} className="p-4 border-r last:border-r-0 border-white/10">
                <div className="text-2xl font-extrabold text-gradient">{value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
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
          ['Safe path', 'Plain float variables with shallow arithmetic, no division, low fan-in, and no accumulator updates are marked for demotion.'],
          ['Blocked path', 'Division chains, deep expression trees, accumulator targets, and unsupported types stay at FP32.'],
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
