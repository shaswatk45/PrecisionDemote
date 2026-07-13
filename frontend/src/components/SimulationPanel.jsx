import { useState, useMemo, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// Math helpers to simulate binary precision roundoff via IEEE 754 bit-masking
function toFP32(val) {
  return Math.fround(val)
}

function toFP16(val) {
  if (val === 0) return 0
  if (!isFinite(val)) return val
  const absVal = Math.abs(val)
  // FP16 overflow limit
  if (absVal > 65504) return val > 0 ? Infinity : -Infinity
  // FP16 subnormal limit
  if (absVal < 5.96e-8) return 0

  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setFloat32(0, val, false)
  let bits = view.getUint32(0, false)
  
  // Truncate mantissa to 10 bits (clear lower 13 bits of FP32 mantissa)
  bits = bits & 0xffffe000
  view.setUint32(0, bits, false)
  return view.getFloat32(0, false)
}

function toBF16(val) {
  if (val === 0) return 0
  if (!isFinite(val)) return val
  const absVal = Math.abs(val)
  // Underflow limit
  if (absVal < 1.17e-38) return 0

  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setFloat32(0, val, false)
  let bits = view.getUint32(0, false)
  
  // Truncate mantissa to 7 bits (clear lower 16 bits of FP32 mantissa)
  bits = bits & 0xffff0000
  view.setUint32(0, bits, false)
  return view.getFloat32(0, false)
}

export default function SimulationPanel({ code = '' }) {
  const [kernelType, setKernelType] = useState('dot_product')
  const [seed, setSeed] = useState(1)

  // Auto-detect kernel from code
  useEffect(() => {
    if (code.includes('dot_product')) setKernelType('dot_product')
    else if (code.includes('layer_norm')) setKernelType('layer_norm')
    else if (code.includes('scale_kernel')) setKernelType('scale_kernel')
    else if (code.includes('deep')) setKernelType('deep')
  }, [code])

  // Run selected simulation
  const simulationResults = useMemo(() => {
    // Seeded random helper for reproducible inputs
    let s = seed
    const rand = () => {
      const x = Math.sin(s++) * 10000
      return x - Math.floor(x)
    }

    const dataPoints = []
    let finalFP32 = 0
    let finalFP16 = 0
    let finalBF16 = 0

    if (kernelType === 'dot_product') {
      const N = 40
      const a = Array.from({ length: N }, () => toFP32((rand() * 10) - 5))
      const b = Array.from({ length: N }, () => toFP32((rand() * 10) - 5))
      
      let sum32 = 0
      let sum16 = 0
      let sumB16 = 0

      for (let i = 0; i < N; i++) {
        const prod32 = toFP32(a[i] * b[i])
        sum32 = toFP32(sum32 + prod32)

        const prod16 = toFP16(toFP16(a[i]) * toFP16(b[i]))
        sum16 = toFP16(sum16 + prod16)

        const prodB16 = toBF16(toBF16(a[i]) * toBF16(b[i]))
        sumB16 = toBF16(sumB16 + prodB16)

        const err16 = sum32 === 0 ? 0 : Math.abs(sum16 - sum32) / Math.abs(sum32)
        const errB16 = sum32 === 0 ? 0 : Math.abs(sumB16 - sum32) / Math.abs(sum32)

        dataPoints.push({
          step: i + 1,
          'FP16 Relative Error': isFinite(err16) ? err16 * 100 : 0,
          'BF16 Relative Error': isFinite(errB16) ? errB16 * 100 : 0,
        })
      }

      finalFP32 = sum32
      finalFP16 = sum16
      finalBF16 = sumB16

    } else if (kernelType === 'scale_kernel') {
      // Showcases range overflow
      const N = 10
      const gain = 70000.0 // overflows FP16 max 65504
      const inputs = Array.from({ length: N }, (_, i) => toFP32((i + 1) * 2.5))

      for (let i = 0; i < N; i++) {
        const x = inputs[i]
        
        // FP32
        const scaled32 = toFP32(gain + x)
        
        // FP16
        const gain16 = toFP16(gain)
        const scaled16 = toFP16(gain16 + toFP16(x))

        // BF16
        const gainB16 = toBF16(gain)
        const scaledB16 = toBF16(gainB16 + toBF16(x))

        const err16 = isFinite(scaled16) ? (Math.abs(scaled16 - scaled32) / scaled32) : 1.0 // 100% representation for overflow
        const errB16 = Math.abs(scaledB16 - scaled32) / scaled32

        dataPoints.push({
          step: i + 1,
          'FP16 Relative Error': err16 * 100,
          'BF16 Relative Error': errB16 * 100,
        })

        if (i === N - 1) {
          finalFP32 = scaled32
          finalFP16 = scaled16
          finalBF16 = scaledB16
        }
      }

    } else if (kernelType === 'layer_norm') {
      const N = 20
      const x = Array.from({ length: N }, () => toFP32(rand() * 5))
      
      let sum32 = 0
      let sum16 = 0
      let sumB16 = 0

      for (let i = 0; i < N; i++) {
        sum32 = toFP32(sum32 + x[i])
        sum16 = toFP16(sum16 + toFP16(x[i]))
        sumB16 = toBF16(sumB16 + toBF16(x[i]))
      }

      const invN32 = toFP32(1.0 / N)
      const invN16 = toFP16(1.0 / N)
      const invNB16 = toBF16(1.0 / N)

      const mean32 = toFP32(sum32 * invN32)
      const mean16 = toFP16(sum16 * invN16)
      const meanB16 = toBF16(sumB16 * invNB16)

      for (let i = 0; i < N; i++) {
        const diff32 = toFP32(x[i] - mean32)
        const diff16 = toFP16(toFP16(x[i]) - mean16)
        const diffB16 = toBF16(toBF16(x[i]) - meanB16)

        const err16 = diff32 === 0 ? 0 : Math.abs(diff16 - diff32) / Math.abs(diff32)
        const errB16 = diff32 === 0 ? 0 : Math.abs(diffB16 - diff32) / Math.abs(diff32)

        dataPoints.push({
          step: i + 1,
          'FP16 Relative Error': isFinite(err16) ? err16 * 100 : 0,
          'BF16 Relative Error': isFinite(errB16) ? errB16 * 100 : 0,
        })
      }

      finalFP32 = mean32
      finalFP16 = mean16
      finalBF16 = meanB16

    } else { // deep chain
      const N = 8
      const inputs = Array.from({ length: N }, () => toFP32(rand() * 1.5))
      
      let val32 = inputs[0]
      let val16 = toFP16(inputs[0])
      let valB16 = toBF16(inputs[0])

      for (let i = 1; i < N; i++) {
        val32 = toFP32(val32 * inputs[i])
        val16 = toFP16(val16 * toFP16(inputs[i]))
        valB16 = toBF16(valB16 * toBF16(inputs[i]))

        const err16 = Math.abs(val16 - val32) / Math.abs(val32)
        const errB16 = Math.abs(valB16 - val32) / Math.abs(val32)

        dataPoints.push({
          step: i,
          'FP16 Relative Error': isFinite(err16) ? err16 * 100 : 0,
          'BF16 Relative Error': isFinite(errB16) ? errB16 * 100 : 0,
        })
      }

      finalFP32 = val32
      finalFP16 = val16
      finalBF16 = valB16
    }

    return { dataPoints, finalFP32, finalFP16, finalBF16 }
  }, [kernelType, seed])

  const { dataPoints, finalFP32, finalFP16, finalBF16 } = simulationResults

  const formatRelErr = (val, ref) => {
    if (!isFinite(val)) return 'OVERFLOW (INF)'
    const err = Math.abs(val - ref) / Math.abs(ref)
    return `${(err * 100).toFixed(4)}%`
  }

  return (
    <div className="nv-panel p-6 space-y-6 relative font-sans">
      <div className="corner-square" />
      
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4 bg-[#050505] -mx-6 -mt-6 p-6">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-nv">Dynamic Precision Simulator</p>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">IEEE 754 Truncation Simulation</h3>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={kernelType}
            onChange={(e) => setKernelType(e.target.value)}
            className="bg-surface-dark border border-line text-xs rounded-sm px-3 py-1.5 font-bold uppercase tracking-wider text-white focus:outline-none focus:border-nv"
          >
            <option value="dot_product">Dot Product Kernel</option>
            <option value="scale_kernel">Scale Kernel (Overflow)</option>
            <option value="layer_norm">Layer Norm Kernel</option>
            <option value="deep">Deep Multiplication Chain</option>
          </select>
          
          <button
            onClick={() => setSeed(s => s + 1)}
            className="btn-outline-dark text-xs px-3 py-1.5"
          >
            Regenerate Inputs
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Results Metrics Panel */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-nv">Simulation Outputs</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['FP32 Output (Ref)', finalFP32, 'text-white', '0.0000%'],
              ['FP16 Output', finalFP16, isFinite(finalFP16) ? 'text-safe' : 'text-unsafe', formatRelErr(finalFP16, finalFP32)],
              ['BF16 Output', finalBF16, 'text-warn', formatRelErr(finalBF16, finalFP32)],
            ].map(([label, val, col, err]) => (
              <div key={label} className="nv-panel p-4 bg-surface-elevated/40 border border-line text-center">
                <div className="text-[10px] text-mute uppercase font-mono tracking-wider mb-2">{label}</div>
                <div className={`text-base font-black font-mono truncate ${col}`}>
                  {typeof val === 'number' && isFinite(val) ? val.toPrecision(5) : String(val)}
                </div>
                <div className="text-[10px] text-stone font-mono mt-1 tracking-wide">{err}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#050505] border border-line p-4 rounded-sm space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Rule Verification</h4>
            {kernelType === 'dot_product' && (
              <p className="text-[11px] text-mute leading-relaxed">
                <strong>Rule 2 (Accumulator) Proof:</strong> Note how the FP16 error rate compounds over loop iterations. Rounding errors in FP16 accumulate systematically ($O(N \cdot \epsilon)$) because the mantissa has only 10 bits of precision. The static analyzer correctly flags this accumulator loop variable as <span className="text-unsafe font-bold">UNSAFE</span> to demote.
              </p>
            )}
            {kernelType === 'scale_kernel' && (
              <p className="text-[11px] text-mute leading-relaxed">
                <strong>Rule 6 (Overflow Redirect) Proof:</strong> The gain constant ($70,000$) is greater than the FP16 range limit of $65,504$. In FP16 arithmetic, this results in an immediate, catastrophic <span className="text-unsafe font-bold">OVERFLOW (Infinity)</span>. However, BF16 uses the same exponent scale as FP32, allowing it to represent the gain safely with a tiny rounding loss.
              </p>
            )}
            {kernelType === 'layer_norm' && (
              <p className="text-[11px] text-mute leading-relaxed">
                <strong>Rule 3 (Division) Proof:</strong> Performing division ($1.0 / n$) triggers high relative precision error in narrow floating-point formats, as demonstrated by the error spikes after division parameters feed downstream operations.
              </p>
            )}
            {kernelType === 'deep' && (
              <p className="text-[11px] text-mute leading-relaxed">
                <strong>Rule 4 (Arithmetic Depth) Proof:</strong> Watch how relative error steps upward at each multiply step. In a long, nested calculation chain, precision degrades rapidly, validating why the compiler pass halts demotion when chain depth exceeds 3.
              </p>
            )}
          </div>
        </div>

        {/* Recharts Error Oscilloscope */}
        <div className="space-y-4 flex flex-col h-full min-h-[300px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-nv">Error Propagation Curve (%)</p>
          <div className="flex-1 bg-black border border-line rounded-sm p-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataPoints} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="step" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'monospace' }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'monospace' }} unit="%" />
                <Tooltip
                  contentStyle={{ background: '#0d0d0d', border: '1px solid #2a2a2a', fontSize: '11px', color: '#fff', fontFamily: 'monospace' }}
                  itemStyle={{ fontSize: '10px' }}
                />
                <Line type="monotone" dataKey="FP16 Relative Error" stroke="#14b8a6" strokeWidth={1.5} dot={{ r: 2.5 }} />
                <Line type="monotone" dataKey="BF16 Relative Error" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
