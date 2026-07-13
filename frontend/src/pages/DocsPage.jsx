import { motion } from 'framer-motion'

export default function DocsPage() {
  const rules = [
    { num: '01', name: 'Type validation', desc: 'Verifies the type is exactly float. Excludes double, half, pointers, or custom typedefs from automatic type narrowing.' },
    { num: '02', name: 'Accumulator detection', desc: 'Flags variables modified inside loops (e.g. sum += x). Accumulation compounds rounding errors exponentially, which is catastrophic in FP16.' },
    { num: '03', name: 'Division scanner', desc: 'Excludes operations involving division (/). FP16 division exhibits poor precision near denominators close to zero.' },
    { num: '04', name: 'Chain depth calculation', desc: 'Propagates arithmetic expression depth transitive-wise. Chains longer than 3 operations accumulate relative roundoff exceeding 0.5%.' },
    { num: '05', name: 'Fan-in checks', desc: 'Counts upstream dependencies feeding a variable. Variables with high fan-in (>5) act as sinks for accumulated rounding noise.' },
    { num: '06', name: 'Overflow redirect', desc: 'Audits constant values against FP16\'s limits (±65504). If overflow is the only hazard, redirects the variable to __bf16.' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-10 font-sans">
      <div className="space-y-2 border-b border-line pb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-nv">System Specifications</p>
        <h1 className="text-3xl font-black uppercase tracking-wider text-white">Documentation & Compiler Specs</h1>
        <p className="text-mute text-xs uppercase tracking-wider font-mono">Clang/LLVM Static Analysis compiler pass internals</p>
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8">
        {/* Left Column: Architecture details */}
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-bold uppercase tracking-wider text-white border-b border-line pb-2">Analysis Engine Flow</h2>
            <p className="text-xs text-body leading-relaxed">
              PrecisionDemote operates as a Clang LibTooling pass over the Abstract Syntax Tree (AST) of C/C++ source code. The compilation pass runs three sequential AST visitors on each function declaration:
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                ['01', 'AST PARSE', 'Traverses AST and registers all local float declarations.'],
                ['02', 'ACCUMULATORS', 'Audits binary operators and assignments for accumulation loops.'],
                ['03', 'DEPENDENCY GRAPH', 'Traces references to construct the arithmetic dependency chain.'],
              ].map(([num, title, text]) => (
                <div key={title} className="nv-panel p-4 relative">
                  <div className="corner-square opacity-40" />
                  <span className="font-mono text-xs font-bold text-nv bg-[#1a1a1a] border border-line px-1.5 py-0.5 rounded-sm">{num}</span>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mt-3 mb-1">{title}</h4>
                  <p className="text-[11px] text-mute leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold uppercase tracking-wider text-white border-b border-line pb-2">Heuristic Safety Gauntlet</h2>
            <p className="text-xs text-body leading-relaxed">
              Every float variable runs through the same gauntlet of 6 rules. The first rule to fail blocks type narrowing:
            </p>
            <div className="space-y-3">
              {rules.map((r) => (
                <div key={r.num} className="nv-panel p-4 flex items-start gap-4 relative">
                  <div className="corner-square opacity-40" />
                  <span className="font-mono text-xs font-bold text-nv">{r.num}</span>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase text-white tracking-wider">{r.name}</h3>
                    <p className="text-[11px] text-mute leading-relaxed">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Code representations and specifications */}
        <div className="space-y-8">
          <section className="nv-panel p-5 relative space-y-4">
            <div className="corner-square" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-nv">Format Specifications</h3>
            
            <div className="space-y-3 font-mono text-xs uppercase">
              {[
                ['Format', 'FP32', 'FP16', 'BF16'],
                ['Total Bits', '32 bits', '16 bits', '16 bits'],
                ['Exponent Range', '8 bits', '5 bits', '8 bits'],
                ['Mantissa Precision', '23 bits', '10 bits', '7 bits'],
                ['Max Finite Value', '3.4e38', '65,504', '3.4e38'],
                ['Underflow Limit', '1.4e-45', '5.96e-8', '1.17e-38'],
              ].map(([label, fp32, fp16, bf16], idx) => (
                <div key={label} className={`flex justify-between py-1.5 ${idx === 0 ? 'border-b border-line text-white font-bold pb-2' : 'text-mute'}`}>
                  <span>{label}</span>
                  <span className="w-16 text-right">{fp32}</span>
                  <span className="w-16 text-right">{fp16}</span>
                  <span className="w-16 text-right">{bf16}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="nv-panel p-5 relative space-y-4">
            <div className="corner-square" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-nv">Clang API Interfaces</h3>
            <p className="text-xs text-body leading-relaxed">
              The real-time compiler utilizes the following core C++ Clang LibTooling classes to parse, analyze, and rewrite the AST:
            </p>
            <ul className="space-y-2 font-mono text-[11px] text-mute uppercase tracking-wider">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-nv rounded-full" /> clang::RecursiveASTVisitor</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-nv rounded-full" /> clang::ASTConsumer</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-nv rounded-full" /> clang::ASTFrontendAction</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-nv rounded-full" /> clang::Rewriter</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
