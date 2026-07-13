import SimulationPanel from '../components/SimulationPanel'

export default function SimulatorPage({ code }) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8 font-sans">
      <div className="space-y-2 border-b border-line pb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-nv">Numeric Simulator</p>
        <h1 className="text-3xl font-black uppercase tracking-wider text-white">Precision Roundoff Simulator</h1>
        <p className="text-mute text-xs uppercase tracking-wider font-mono">IEEE 754 float32 to float16 / bfloat16 arithmetic verification</p>
      </div>

      <div className="text-xs text-body leading-relaxed max-w-3xl">
        This simulator lets you physically audit rounding error propagation, arithmetic loops, and constant limits. By applying bitwise masking to normal float64/float32 numbers, it isolates mantissa allocations in client-side Javascript. Select any kernel below to evaluate precision behavior.
      </div>

      <SimulationPanel code={code} />
    </div>
  )
}
