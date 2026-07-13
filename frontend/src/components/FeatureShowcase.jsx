import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { RulerCarousel } from './RulerCarousel'
import { GlowingEffect } from './ui/glowing-effect'

const FEATURES = [
  {
    id: 1, title: 'AST ENGINE', tag: 'Engine',
    desc: 'A real Clang LibTooling pass over the C/C++ Abstract Syntax Tree — not regex. It walks every function, builds a per-function float dependency graph, and reasons about each declaration.',
    metric: 'LLVM 18 · RecursiveASTVisitor · clang::Rewriter',
  },
  {
    id: 2, title: 'SAFETY SCORE', tag: 'Analysis',
    desc: 'Every float variable gets a graded 0–100 demotion-safety score — not a binary verdict. Accumulation, division, depth, fan-in and overflow each pull the score down, giving a ranked heatmap of risk.',
    metric: '0–100 per variable',
  },
  {
    id: 3, title: 'ERROR BOUNDS', tag: 'Numerics',
    desc: 'A static, first-order estimate of the relative rounding error each demotion introduces, propagated over the dependency chain using the target format\'s unit roundoff.',
    metric: 'FP16 u ≈ 4.9e-4 · BF16 u ≈ 3.9e-3',
  },
  {
    id: 4, title: 'FP16 · BF16', tag: 'Mixed precision',
    desc: 'Per variable, the tool recommends the optimal narrow type: __fp16 when precision- and range-safe, __bf16 when only FP16 range fails (BF16 shares FP32\'s exponent range), or float on a precision hazard.',
    metric: '3 target types, chosen per variable',
  },
  {
    id: 5, title: 'OVERFLOW', tag: 'Rule 6',
    desc: 'Range analysis walks constant magnitudes — and inherits them across the dependency graph — to flag any value beyond FP16\'s ±65504 before it silently overflows at runtime.',
    metric: 'FP16 max ±65504 · APFloat-based',
  },
  {
    id: 6, title: 'REWRITE', tag: 'Codegen',
    desc: 'Rewrites the source in place to true mixed precision — emitting both __fp16 and __bf16 in a single pass — while preserving every comment and byte of formatting.',
    metric: 'clang::Rewriter · mixed output',
  },
  {
    id: 7, title: 'MONACO IDE', tag: 'Frontend',
    desc: 'A VS Code (Monaco) editor where the source itself is the analysis surface: each line is painted teal / amber / rose for __fp16 / __bf16 / kept, with hover cards showing score, target, error bound and reason.',
    metric: 'Bundled · annotated decorations',
  },
  {
    id: 8, title: 'DEP GRAPH', tag: 'Visualisation',
    desc: 'An interactive per-function dependency graph, auto-laid-out and coloured by recommended type, so you can trace exactly how a division or overflow propagates and blocks downstream variables.',
    metric: 'React Flow · dagre layout',
  },
  {
    id: 9, title: 'SARIF', tag: 'Interop',
    desc: 'One-click export to SARIF 2.1.0 — the industry-standard static-analysis format — so results drop straight into GitHub code scanning or a VS Code SARIF viewer. Plus rewritten-source and JSON export.',
    metric: 'SARIF 2.1.0 · JSON · .cpp',
  },
  {
    id: 10, title: 'VERIFIED', tag: 'Quality',
    desc: 'Backed by a real, reproducible test suite: 68 tool checks over 9 test cases and 14 backend analyzer unit tests, all green — plus a hardened, injection-safe Express bridge to the compiler.',
    metric: '68 tool checks · 14 unit tests',
  },
]

export default function FeatureShowcase() {
  const [active, setActive] = useState(4)
  const onActiveChange = useCallback((idx) => setActive(idx), [])
  const f = FEATURES[active] || FEATURES[0]

  return (
    <section id="features" className="space-y-8 py-8 border-t border-line">
      <div className="text-center space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-nv">System Capabilities</p>
        <h2 className="text-2xl font-black uppercase tracking-wider text-white">Ten capabilities, one ruler</h2>
        <p className="text-xs text-mute uppercase tracking-wider">Explore each technical feature of the static analysis pass</p>
      </div>

      <div className="nv-panel py-10 overflow-hidden relative">
        <GlowingEffect disabled={false} glow={true} proximity={64} spread={40} borderWidth={1.5} />
        <div className="corner-square" />
        <RulerCarousel
          originalItems={FEATURES.map((x) => ({ id: x.id, title: x.title }))}
          onActiveChange={onActiveChange}
          initialIndex={4}
        />

        <div className="max-w-2xl mx-auto px-6 mt-8 min-h-[140px]">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="text-center space-y-4"
          >
            <div>
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-nv border border-nv/30 bg-nv/5 rounded-sm px-3 py-1">
                {f.tag}
              </span>
            </div>
            <p className="text-sm text-body leading-relaxed max-w-xl mx-auto">{f.desc}</p>
            <p className="font-mono text-xs text-safe uppercase tracking-wider">{f.metric}</p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
