import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Play, Database, FileCode, CheckCircle, Zap } from 'lucide-react'
import { GlowingEffect } from '../components/ui/glowing-effect'
import { cn } from '../lib/utils'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const STEPS = [
  {
    title: '1. Input C/C++ Code',
    icon: FileCode,
    desc: 'The tool ingests your raw C/C++ computational kernels. We start with a baseline where everything is forced into float32 (FP32), ignoring potential performance benefits of native half-precision formats.',
    code: `float compute(float* a, float* b, int n) {\n    float sum = 0.0f;\n    for (int i = 0; i < n; i++) {\n        float x = a[i];\n        float y = b[i];\n        sum += x * y;\n    }\n    return sum;\n}`,
    hl: [4, 5, 6]
  },
  {
    title: '2. AST Generation & Parsing',
    icon: Database,
    desc: 'Using Clang\'s LibTooling, we construct an Abstract Syntax Tree (AST). This isn\'t regex—the compiler genuinely understands the scope, types, and mathematical relationships of every declared variable.',
    code: `// Internal AST Representation:\nFunctionDecl 'compute' (float* a, float* b, int n)\n|-CompoundStmt\n| |-DeclStmt\n| | \`-VarDecl 'sum' 'float' cinit\n| |-ForStmt\n|   |-DeclStmt (i=0)\n|   |-BinaryOperator '<'\n|   |-UnaryOperator '++'\n|   \`-CompoundStmt\n|     |-VarDecl 'x' 'float' = a[i]\n|     |-VarDecl 'y' 'float' = b[i]\n|     \`-CompoundAssignOperator '+=' (x * y)`,
    hl: []
  },
  {
    title: '3. Data-Flow & Risk Analysis',
    icon: Zap,
    desc: 'We calculate a safety score (0-100) and track bounding errors. Deep arithmetic chains, divisions, and accumulation (like our "sum" variable) drastically reduce the safety score, preventing unsafe demotions.',
    code: `// Analysis Diagnostics:\nx:   Fan-in: 1 | Depth: 1 | Score: 98 (SAFE)\ny:   Fan-in: 1 | Depth: 1 | Score: 98 (SAFE)\n\ntmp: Fan-in: 2 | Depth: 2 | Score: 85 (MODERATE)\n\nsum: Accumulator loop detected!\n     Division: false\n     Depth: Infinity\n     Score: 0 (UNSAFE)`,
    hl: [2, 3, 7]
  },
  {
    title: '4. Target Selection',
    icon: CheckCircle,
    desc: 'Based on the analysis, each variable is independently assigned a target type. "x" and "y" are perfectly safe for FP16. "sum" is hazardous and kept at FP32 to protect numerical stability.',
    code: `// Type Recommendations:\nTarget { x }   -> __fp16   (Supported & Safe)\nTarget { y }   -> __fp16   (Supported & Safe)\nTarget { sum } -> float    (Precision Hazard)`,
    hl: [2, 3]
  },
  {
    title: '5. Automated Rewrite',
    icon: Play,
    desc: 'Finally, a source-to-source Clang rewriting pass automatically patches your code in-place. The compiler now knows exactly where to emit fast FP16 instructions without destroying your math.',
    code: `float compute(float* a, float* b, int n) {\n    float sum = 0.0f;\n    for (int i = 0; i < n; i++) {\n        __fp16 x = a[i];\n        __fp16 y = b[i];\n        sum += (float)(x * y);\n    }\n    return sum;\n}`,
    hl: [4, 5, 6]
  }
]

export default function StepByStepPage() {
  const [current, setCurrent] = useState(0)
  
  const handleNext = () => setCurrent(p => Math.min(STEPS.length - 1, p + 1))
  const handlePrev = () => setCurrent(p => Math.max(0, p - 1))

  const step = STEPS[current]
  const Icon = step.icon

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-black font-sans flex flex-col items-center py-12 px-6">
      
      <div className="max-w-5xl w-full flex flex-col items-center space-y-4 mb-10 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-nv">Algorithm Walkthrough</p>
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wider text-white">How PrecisionDemote Works</h1>
        <p className="text-sm text-mute max-w-2xl leading-relaxed">
          Take a look under the hood. Our tool doesn't just guess where to use FP16—it applies a rigorous, compiler-backed pipeline to every single floating-point operation in your codebase.
        </p>
      </div>

      <div className="max-w-5xl w-full grid lg:grid-cols-[1.1fr_1fr] gap-8 h-full min-h-[480px]">
        {/* Left Side: Text and Controls */}
        <div className="nv-panel p-8 relative overflow-hidden flex flex-col justify-between">
          <GlowingEffect disabled={false} glow={true} proximity={80} spread={40} borderWidth={1.5} />
          <div className="corner-square" />
          
          <div className="relative z-10 space-y-6">
            <div className="w-12 h-12 bg-nv rounded-sm flex items-center justify-center">
              <Icon className="w-6 h-6 text-black" />
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-2xl font-black uppercase tracking-widest text-white">{step.title}</h2>
                <p className="text-sm text-body leading-relaxed max-w-sm">{step.desc}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="relative z-10 flex items-center justify-between pt-8 border-t border-line mt-12">
            <button 
              onClick={handlePrev}
              disabled={current === 0}
              className="w-10 h-10 border border-line flex items-center justify-center text-mute hover:text-white disabled:opacity-30 disabled:hover:text-mute transition-colors bg-[#0a0a0a]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex gap-2">
              {STEPS.map((_, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "w-8 h-1 rounded-sm transition-colors duration-300",
                    idx === current ? "bg-nv" : idx < current ? "bg-nv/40" : "bg-line"
                  )}
                />
              ))}
            </div>

            <button 
              onClick={handleNext}
              disabled={current === STEPS.length - 1}
              className="w-10 h-10 border border-nv flex items-center justify-center text-nv hover:bg-nv hover:text-black disabled:opacity-30 disabled:border-line disabled:text-mute disabled:hover:bg-transparent transition-colors bg-nv/5"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Side: Code Window */}
        <div className="nv-panel relative overflow-hidden flex flex-col border-[#2a2a2a]">
          <GlowingEffect disabled={false} glow={true} proximity={80} spread={40} borderWidth={1.5} />
          
          <div className="border-b border-[#2a2a2a] px-4 py-3 flex items-center gap-2 bg-[#000000] relative z-10">
            <span className="w-2 h-2 bg-nv rounded-full" />
            <span className="text-[10px] text-mute uppercase font-mono tracking-widest">
              {current === 1 ? 'AST Output' : current === 2 ? 'Analysis Log' : current === 3 ? 'Target Matrix' : 'source.cpp'}
            </span>
          </div>

          <div className="relative z-10 flex-1 bg-black p-4 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                <SyntaxHighlighter
                  language="cpp"
                  style={vscDarkPlus}
                  customStyle={{ background: 'transparent', padding: 0, margin: 0, fontSize: '13px' }}
                  wrapLines={true}
                  showLineNumbers={current === 0 || current === 4}
                  lineProps={lineNumber => {
                    let style = { display: "block", paddingLeft: '8px' };
                    if (step.hl.includes(lineNumber)) {
                      style.backgroundColor = "rgba(118, 185, 0, 0.1)";
                      style.borderLeft = "2px solid #76b900";
                    }
                    return { style };
                  }}
                >
                  {step.code}
                </SyntaxHighlighter>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
