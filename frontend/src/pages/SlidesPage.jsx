import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X, Play, Pause, Layers, Cpu, Award, Zap } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'

export default function SlidesPage() {
  const navigate = useNavigate()
  const [slide, setSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const slides = [
    // Slide 1: Title
    {
      type: 'title',
      render: () => (
        <div className="h-full flex flex-col justify-center items-center text-center space-y-6 px-10">
          <div className="flex items-center gap-4 bg-surface-dark border border-line px-5 py-3 rounded-sm">
            <div className="w-10 h-10 rounded-sm bg-nv flex items-center justify-center text-black font-black text-lg">RV</div>
            <div className="text-left font-mono">
              <div className="text-xs font-bold text-white uppercase tracking-wider">RV College of Engineering</div>
              <div className="text-[10px] text-stone uppercase tracking-widest font-bold">Bengaluru, Karnataka</div>
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-none">
              Precision-Aware<br />
              Type Demotion Framework
            </h1>
            <p className="text-sm text-nv uppercase font-bold tracking-widest font-mono">
              Clang-based static analysis & source-to-source compilation
            </p>
          </div>
          <div className="max-w-xl text-mute text-xs leading-relaxed uppercase font-mono tracking-wider pt-4 border-t border-line">
            Safe FP16/BF16 precision reduction through chain-level data-flow AST auditing
          </div>
        </div>
      ),
    },
    // Slide 2: The Gap
    {
      type: 'content',
      title: '01. The Gap',
      render: () => (
        <div className="grid md:grid-cols-2 gap-8 items-center h-full">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white uppercase tracking-wide">Numerical Instability vs Performance</h3>
            <p className="text-xs text-body leading-relaxed">
              Modern hardware (GPUs, Tensor Cores, vector engines) offers **2–4× throughput gains** with half-precision formats like FP16 and BF16. However, manual conversion is highly error-prone.
            </p>
            <p className="text-xs text-body leading-relaxed">
              Existing compilers and tools suffer from **shallow per-literal checks** and lack the **chain-level data-flow awareness** required for arbitrary, complex C/C++ codebases.
            </p>
          </div>
          <div className="nv-panel p-5 relative space-y-4 bg-surface-dark">
            <div className="corner-square opacity-40" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-nv">Format Layouts</p>
            
            <div className="space-y-3 font-mono text-[10px]">
              {/* FP32 */}
              <div className="space-y-1">
                <div className="flex justify-between uppercase text-white font-bold">
                  <span>FP32 (Single)</span>
                  <span>32 Bits</span>
                </div>
                <div className="flex h-4 border border-line text-[9px] text-center font-bold">
                  <div className="w-[3%] bg-white text-black" title="Sign">S</div>
                  <div className="w-[25%] bg-nv text-black" title="Exponent">8 exp</div>
                  <div className="w-[72%] bg-nv/30 text-white" title="Mantissa">23 mantissa</div>
                </div>
              </div>
              
              {/* FP16 */}
              <div className="space-y-1">
                <div className="flex justify-between uppercase text-safe font-bold">
                  <span>FP16 (Half)</span>
                  <span>16 Bits</span>
                </div>
                <div className="flex h-4 border border-line text-[9px] text-center font-bold">
                  <div className="w-[6%] bg-white text-black">S</div>
                  <div className="w-[31%] bg-safe text-black">5 exp</div>
                  <div className="w-[63%] bg-safe/30 text-white">10 mantissa</div>
                </div>
              </div>

              {/* BF16 */}
              <div className="space-y-1">
                <div className="flex justify-between uppercase text-warn font-bold">
                  <span>BFLOAT16 (Brain)</span>
                  <span>16 Bits</span>
                </div>
                <div className="flex h-4 border border-line text-[9px] text-center font-bold">
                  <div className="w-[6%] bg-white text-black">S</div>
                  <div className="w-[50%] bg-warn text-black">8 exp</div>
                  <div className="w-[44%] bg-warn/30 text-white">7 mantissa</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 3: Core Project Objectives
    {
      type: 'content',
      title: 'Core Project Objectives',
      render: () => (
        <div className="grid sm:grid-cols-2 gap-6 items-center h-full">
          {[
            { title: 'Chain Analysis', desc: 'Trace every floating-point operation from source inputs through expression chains to terminal outputs within Clang\'s AST.' },
            { title: 'Backward Propagation', desc: 'Propagate output error bounds upstream through the data-flow graph to enforce minimum required precision thresholds.' },
            { title: 'AST Rewriting', desc: 'Modify type annotations directly in the source code, replacing double/float with __fp16 or __bf16 dynamically.' },
            { title: 'Dual Verification', desc: 'Compile and run both original and demoted kernels to verify outputs stay strictly within the target error bound.' },
          ].map((item, idx) => (
            <div key={item.title} className="nv-panel p-5 relative space-y-2 bg-surface-dark">
              <div className="corner-square opacity-30" />
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full border border-nv/40 flex items-center justify-center font-mono text-[10px] text-nv font-bold">{idx + 1}</span>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">{item.title}</h4>
              </div>
              <p className="text-[11px] text-mute leading-relaxed pl-8">{item.desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    // Slide 4: System Architecture
    {
      type: 'content',
      title: 'System Architecture',
      render: () => (
        <div className="grid md:grid-cols-4 gap-4 items-stretch h-full">
          {[
            { step: '01', title: 'Clang AST Pass', desc: 'RecursiveASTVisitor walks variables, constructing a structured DFG mapping operations.' },
            { step: '02', title: 'Backward Prop', desc: 'Computes precision needs from outputs back to sources based on threshold constraints.' },
            { step: '03', title: 'AST Rewriter', desc: 'Emits code with safe types replaced in place, preserving layout and comments.' },
            { step: '04', title: 'Dual Verifier', desc: 'Runs compiled code versions side-by-side to audit exact numerical error.' },
          ].map((c) => (
            <div key={c.step} className="nv-panel p-4 flex flex-col justify-between relative bg-surface-dark text-left">
              <div className="corner-square opacity-30" />
              <span className="font-mono text-xs font-bold text-nv bg-black/40 border border-line px-1.5 py-0.5 rounded-sm w-max">{c.step}</span>
              <div className="space-y-1.5 mt-4">
                <h4 className="text-xs font-bold uppercase text-white tracking-wide">{c.title}</h4>
                <p className="text-[10px] text-mute leading-relaxed">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    // Slide 5: DFG Construction Process
    {
      type: 'content',
      title: 'DFG Construction Process',
      render: () => (
        <div className="grid md:grid-cols-[auto_1fr] gap-8 items-center h-full">
          <div className="space-y-3">
            {['Parse Source', 'Identify Nodes', 'Trace Chains', 'Annotate Edges'].map((step, idx) => (
              <div key={step} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-sm bg-nv text-black flex items-center justify-center font-mono text-xs font-black">{idx + 1}</span>
                <span className="text-xs font-bold uppercase text-white tracking-wider">{step}</span>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase text-nv font-mono">AST Traversal & Auditing</h3>
            <p className="text-xs text-mute leading-relaxed">
              Leveraging Clang's C++ AST interfaces, the analysis visitor traverses statement trees to identify variable definitions, constant literals, and operations.
            </p>
            <p className="text-xs text-mute leading-relaxed">
              Unlike local compiler passes, this builds a cross-statement dependency map. Rounded values from one expression are tracked downstream so errors can be monitored across the entire calculation chain.
            </p>
          </div>
        </div>
      ),
    },
    // Slide 6: Backward Propagation Engine
    {
      type: 'content',
      title: 'Backward Propagation Engine',
      render: () => (
        <div className="space-y-4 h-full flex flex-col justify-center">
          <div className="nv-panel p-4 bg-nv/5 border border-nv/30 rounded-sm relative text-left">
            <div className="corner-square opacity-40" />
            <h4 className="text-xs font-bold text-nv uppercase tracking-wider mb-1">Key Propagation Insight</h4>
            <p className="text-[11px] text-mute leading-relaxed">
              Output precision requirements cascade backward through the data-flow graph. If any downstream calculation requires high precision, the parent node is locked to standard float/FP32 to prevent rounding noise from polluting the result.
            </p>
          </div>
          
          <div className="overflow-x-auto border border-line rounded-sm">
            <table className="w-full text-[10px] font-mono uppercase text-left">
              <thead>
                <tr className="bg-[#0c0c0c] border-b border-line text-white font-bold">
                  <th className="p-3">Format</th>
                  <th className="p-3">Mantissa Bits</th>
                  <th className="p-3">Exponent Bits</th>
                  <th className="p-3">Precision Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-mute">
                <tr>
                  <td className="p-3 font-bold text-white">FP32 (Standard)</td>
                  <td className="p-3">23-bit</td>
                  <td className="p-3">8-bit</td>
                  <td className="p-3">~7 decimal digits</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-warn">BF16 (Brain Float)</td>
                  <td className="p-3">7-bit</td>
                  <td className="p-3">8-bit</td>
                  <td className="p-3">~2 decimal digits</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-safe">FP16 (Half)</td>
                  <td className="p-3">10-bit</td>
                  <td className="p-3">5-bit</td>
                  <td className="p-3">~3 decimal digits</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    // Slide 7: Tech Stack
    {
      type: 'content',
      title: 'Tech Stack',
      render: () => (
        <div className="grid sm:grid-cols-3 gap-4 items-center h-full">
          {[
            { icon: Layers, name: 'Clang LibTooling', desc: 'Allows direct execution of AST traversal plugins.' },
            { icon: Cpu, name: 'LLVM::APFloat', desc: 'Arbitrary-precision float libraries for static error bounds.' },
            { icon: Award, name: 'Clang ASTContext', desc: 'Maintains source-to-source mapping for compiler rewrites.' },
            { icon: Zap, name: 'RecursiveASTVisitor', desc: 'C++ template class to visit and inspect AST nodes.' },
            { icon: Layers, name: 'Custom DFG Engine', desc: 'Builds flow graphs tracing variables per function.' },
            { icon: Cpu, name: 'Dual-Verifier', desc: 'Validates runtime output errors side-by-side.' },
          ].map((t) => {
            const Icon = t.icon
            return (
              <div key={t.name} className="nv-panel p-4 relative text-left bg-surface-dark">
                <div className="corner-square opacity-30" />
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-nv" />
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">{t.name}</h4>
                </div>
                <p className="text-[10px] text-mute leading-relaxed mt-2">{t.desc}</p>
              </div>
            )
          })}
        </div>
      ),
    },
    // Slide 8: Methodology & Comparison
    {
      type: 'content',
      title: 'Methodology & Comparison',
      render: () => (
        <div className="overflow-x-auto border border-line rounded-sm h-full flex flex-col justify-center">
          <table className="w-full text-[10px] font-mono uppercase text-left">
            <thead>
              <tr className="bg-[#0c0c0c] border-b border-line text-white font-bold">
                <th className="p-3">Feature</th>
                <th className="p-3 text-nv">Our Framework</th>
                <th className="p-3">Prior Approaches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-mute">
              {[
                ['Analysis Scope', 'Full computation chain', 'Per-literal / Isolated'],
                ['Propagation', 'Backward (Output → Input)', 'None / Manual'],
                ['Target Code', 'Arbitrary C/C++ Source', 'DL Compilers only'],
                ['Automation', 'AST Auto-rewrite', 'Manual Annotation'],
                ['Verification', 'Dual-precision runtime', 'None / Heuristic'],
                ['Error Control', 'Configurable ε threshold', 'Fixed / None'],
              ].map(([f, ours, old]) => (
                <tr key={f} className="hover:bg-white/5">
                  <td className="p-3 font-bold text-white">{f}</td>
                  <td className="p-3 text-nv font-bold">{ours}</td>
                  <td className="p-3">{old}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    // Slide 9: Key Deliverables
    {
      type: 'content',
      title: 'Key Deliverables',
      render: () => (
        <div className="grid sm:grid-cols-2 gap-4 items-stretch h-full">
          {[
            ['D1', 'AST Analysis Pass', 'Clang plugin that audits local floating-point variables and operations to construct a source-to-sink data-flow graph.'],
            ['D2', 'Propagation Engine', 'Propagates tolerances upstream, assigning FP32, FP16, or BF16 type tags to variables.'],
            ['D3', 'AST Rewriter', 'Performs C++ AST code rewrites to substitute float types with narrower formats.'],
            ['D4', 'Dual-Precision Verifier', 'Compiles and runs both code versions to verify compliance with error tolerances.'],
          ].map(([tag, name, desc]) => (
            <div key={tag} className="nv-panel p-4 flex gap-4 relative bg-surface-dark text-left">
              <div className="corner-square opacity-30" />
              <span className="font-mono text-xs font-black text-nv bg-black/40 border border-line w-8 h-8 rounded-sm flex items-center justify-center shrink-0">{tag}</span>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">{name}</h4>
                <p className="text-[10px] text-mute leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    // Slide 10: Evaluation & Results
    {
      type: 'content',
      title: 'Evaluation & Results',
      render: () => {
        const speedupData = [
          { name: 'FFT', val: 2.1 },
          { name: 'Conv', val: 2.8 },
          { name: 'IIR', val: 1.6 },
          { name: 'Softmax', val: 2.4 },
          { name: 'DotProd', val: 3.0 },
        ]
        return (
          <div className="grid md:grid-cols-[1fr_1.2fr] gap-6 items-center h-full">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Avg Speedup', '1.5x - 3.0x', 'text-nv'],
                  ['Relative Error', '< 0.1%', 'text-safe'],
                  ['Verification', '100% Pass', 'text-white'],
                ].map(([label, val, col]) => (
                  <div key={label} className="nv-panel p-3 border border-line text-center bg-surface-dark">
                    <div className="text-[9px] text-mute uppercase font-mono tracking-wider mb-1">{label}</div>
                    <div className={`text-base font-black font-mono ${col}`}>{val}</div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-mute leading-relaxed">
                The framework was evaluated across 5 computational kernels. Results verify significant speedups on FP16-amenable hardware while maintaining strict numerical accuracy constraints.
              </p>
            </div>
            
            <div className="space-y-2 flex flex-col h-full justify-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-nv text-center">Kernel Speedup Comparison</p>
              <div className="h-[180px] bg-black border border-line rounded-sm p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={speedupData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'monospace' }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'monospace' }} />
                    <Bar dataKey="val" radius={[2, 2, 0, 0]}>
                      {speedupData.map((entry, idx) => (
                        <Cell key={idx} fill={idx % 2 === 0 ? '#76b900' : '#14b8a6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )
      },
    },
    // Slide 11: Technical Contributions & Novelty
    {
      type: 'content',
      title: 'Technical Contributions & Novelty',
      render: () => (
        <div className="grid sm:grid-cols-2 gap-4 items-center h-full">
          {[
            ['Chain-Level DFG', 'Constructs complete directed flow graphs spanning loops and statements, moving beyond isolated checks.'],
            ['Backward Engine', 'Integrates backward passes to convert output error tolerances into per-node precision tags.'],
            ['Safe AST Rewrite', 'Utilizes Clang ASTContext to insert proper type-casts and preserve semantic correctness.'],
            ['Dual Verification', 'Validates compiler decisions by comparing outputs side-by-side and applying auto-rollbacks.'],
          ].map(([name, desc]) => (
            <div key={name} className="nv-panel p-4 relative text-left bg-surface-dark space-y-1">
              <div className="corner-square opacity-30" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">{name}</h4>
              <p className="text-[10px] text-mute leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    // Slide 12: Takeaways
    {
      type: 'content',
      title: 'Key Takeaways',
      render: () => (
        <div className="grid md:grid-cols-[auto_1fr] gap-8 items-center h-full">
          <div className="nv-panel p-6 bg-surface-dark border border-line text-center max-w-[200px] mx-auto">
            <div className="w-12 h-12 rounded-sm bg-nv flex items-center justify-center text-black font-black text-xl mx-auto mb-3">RV</div>
            <p className="text-[10px] text-mute uppercase font-mono tracking-wider font-bold">RV College of Engineering</p>
            <p className="text-[9px] text-stone font-mono mt-1 italic">"Go, change the world"</p>
          </div>
          <div className="space-y-3 font-mono text-[10px] text-mute uppercase text-left">
            <div className="flex items-start gap-2.5">
              <span className="text-nv font-bold">✓</span>
              <span><strong>Chain-Level Analysis</strong>: Moves compiler narrowing analysis beyond isolated scalar boundaries.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-nv font-bold">✓</span>
              <span><strong>Backward Propagation</strong>: Automates precision tag planning based on custom output tolerances.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-nv font-bold">✓</span>
              <span><strong>Dual-Verification</strong>: Assures absolute numerical safety using runtime comparisons.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-nv font-bold">✓</span>
              <span><strong>Zero Manual Work</strong>: Runs automatically on existing C++ sources.</span>
            </div>
          </div>
        </div>
      ),
    },
  ]

  const next = () => setSlide((s) => Math.min(s + 1, slides.length - 1))
  const prev = () => setSlide((s) => Math.max(s - 0, 0))

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!isPlaying) return
    const t = setInterval(() => {
      setSlide((s) => {
        if (s >= slides.length - 1) {
          setIsPlaying(false)
          return s
        }
        return s + 1
      })
    }, 7000)
    return () => clearInterval(t)
  }, [isPlaying])

  const cur = slides[slide]

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505] flex flex-col font-sans">
      {/* Top Header */}
      <div className="flex items-center px-8 py-5 border-b border-line bg-black">
        <span className="font-mono text-xs tracking-[0.3em] text-nv font-bold">PROJECT PPT SLIDESHOW</span>
        <span className="ml-4 font-mono text-xs text-stone">
          {String(slide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
        
        <button
          onClick={() => navigate('/')}
          className="ml-auto text-stone hover:text-white transition-colors uppercase font-mono text-[10px] tracking-wider font-bold flex items-center gap-1.5"
        >
          <X className="w-4 h-4" /> Close PPT
        </button>
      </div>

      {/* Main Slide Card Arena */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-auto bg-black">
        <div className="w-full max-w-4xl min-h-[460px] nv-panel bg-[#090909] border border-line p-8 flex flex-col justify-between relative shadow-nv-glow">
          <div className="corner-square" />
          
          {/* Header context */}
          {cur.type === 'content' && (
            <div className="border-b border-line pb-3 mb-6 flex justify-between items-baseline">
              <h2 className="text-sm font-black uppercase text-white tracking-widest">{cur.title}</h2>
              <span className="text-[9px] text-stone font-mono uppercase tracking-widest">PrecisionDemote Framework</span>
            </div>
          )}

          {/* Core representation */}
          <div className="flex-1 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                {cur.render()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* RV status line */}
          {cur.type === 'content' && (
            <div className="border-t border-line pt-4 mt-6 flex justify-between text-[8px] text-stone font-mono uppercase tracking-wider">
              <span>RV College of Engineering · Bengaluru</span>
              <span>AST-Level Data Flow audit</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="px-8 pb-8 pt-4 border-t border-line bg-black">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={prev}
            disabled={slide === 0}
            className="text-stone hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button
            onClick={() => setIsPlaying(p => !p)}
            className="text-nv hover:text-white transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <button
            onClick={next}
            disabled={slide === slides.length - 1}
            className="text-stone hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Dots tracker */}
          <div className="flex items-center gap-1.5 ml-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSlide(idx)}
                className={`h-1.5 rounded-sm transition-all duration-200 ${
                  idx === slide ? 'w-8 bg-nv' : 'w-2 bg-line hover:bg-stone/50'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <span className="ml-auto font-mono text-[9px] text-stone uppercase tracking-wider hidden md:block">
            SPACE/Click next · ← back · Play auto-walk
          </span>
        </div>
      </div>
    </div>
  )
}
