import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie
} from 'recharts'
import { motion } from 'framer-motion'
import ScoreGauge from './ScoreGauge'
import CountUp from './CountUp'
import MemoryShrink from './MemoryShrink'
import ErrorTrace from './ErrorTrace'

const COLORS = {
  fp16: '#14b8a6',
  bf16: '#f59e0b',
  keep: '#f43f5e',
  accent: '#76b900',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="nv-panel px-3 py-2 text-[11px] space-y-1 font-mono uppercase bg-black">
      {label && <p className="text-mute">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

export default function MetricsPanel({ metrics, analysis }) {
  if (!metrics) return null

  const {
    totalFloatVars, fp16Count = 0, bf16Count = 0, keptFloatCount = 0,
    demotionRate, memorySavedPercent, avgSafetyScore = 0,
    maxErrorBound = 0, estimatedSpeedup = 1, bytesSaved = 0,
  } = metrics

  const allNodes = (analysis?.functions || []).flatMap((f) => f.nodes || [])

  const pieData = [
    { name: '__fp16', value: fp16Count, fill: COLORS.fp16 },
    { name: '__bf16', value: bf16Count, fill: COLORS.bf16 },
    { name: 'float', value: keptFloatCount, fill: COLORS.keep },
  ].filter((d) => d.value > 0)

  const barData = [
    { name: 'FP16', value: fp16Count, fill: COLORS.fp16 },
    { name: 'BF16', value: bf16Count, fill: COLORS.bf16 },
    { name: 'Kept', value: keptFloatCount, fill: COLORS.keep },
  ]

  const stats = [
    ['Est. speedup', <CountUp key="s" value={estimatedSpeedup} decimals={2} suffix="×" duration={1100} />, 'bandwidth-bound roofline', 'text-nv'],
    ['Memory saved', <CountUp key="m" value={memorySavedPercent} decimals={1} suffix="%" duration={1100} />, `${bytesSaved} bytes/invocation`, 'text-safe'],
    ['Max rel. error', <CountUp key="e" value={maxErrorBound * 100} decimals={3} suffix="%" duration={1100} />, 'worst-case demoted var', 'text-warn'],
    ['Demotion rate', <CountUp key="d" value={demotionRate} decimals={1} suffix="%" duration={1100} />, `${fp16Count + bf16Count}/${totalFloatVars} narrowed`, 'text-nv'],
  ]

  return (
    <div className="space-y-6 font-sans">
      {/* Hero row: gauge + headline stats */}
      <div className="grid lg:grid-cols-[auto_1fr] gap-6 items-center">
        <div className="nv-panel hud-corners p-6 flex flex-col items-center gap-2">
          <ScoreGauge value={avgSafetyScore} sublabel="avg score" />
          <p className="text-[10px] text-mute uppercase font-mono text-center max-w-[10rem] tracking-wider mt-1">Mean demotion-safety confidence across all float variables</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {stats.map(([label, value, sub, color], i) => (
            <motion.div
              key={label}
              className="metric-card hud-corners"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-nv mb-1">{label}</span>
              <span className={`text-2xl font-black font-mono tracking-tight ${color}`}>{value}</span>
              <span className="text-[10px] text-mute uppercase font-mono tracking-wide mt-1">{sub}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* The physical memory story + the error-bound oscilloscope */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="nv-panel hud-corners p-6">
          <div className="corner-square" />
          <p className="text-xs font-bold uppercase tracking-widest text-nv mb-4">Bit-level anatomy</p>
          <MemoryShrink />
        </div>
        <div className="nv-panel hud-corners p-6">
          <div className="corner-square" />
          <p className="text-xs font-bold uppercase tracking-widest text-nv mb-4">Error-bound trace</p>
          <ErrorTrace nodes={allNodes} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="nv-panel p-6 relative">
          <div className="corner-square" />
          <p className="text-xs font-bold uppercase tracking-widest text-nv mb-4">Target type breakdown</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="nv-panel p-6 relative">
          <div className="corner-square" />
          <p className="text-xs font-bold uppercase tracking-widest text-nv mb-4">Variables by target</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 8 }}>
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {barData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="nv-panel p-6 overflow-auto relative">
        <div className="corner-square" />
        <p className="text-xs font-bold uppercase tracking-widest text-nv mb-4">FP32 vs FP16 vs BF16</p>
        <table className="w-full text-xs text-left uppercase font-mono">
          <thead>
            <tr className="border-b border-line text-stone tracking-wider font-bold">
              <th className="pb-3 pr-6">Property</th>
              <th className="pb-3 pr-6 text-unsafe">FP32</th>
              <th className="pb-3 pr-6 text-safe">FP16</th>
              <th className="pb-3 text-warn">BF16</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[
              ['Bit width', '32', '16', '16'],
              ['Exponent bits', '8', '5', '8'],
              ['Mantissa bits', '23', '10', '7'],
              ['Max finite', '±3.4e38', '±65504', '±3.4e38'],
              ['Unit roundoff', '≈6e-8', '≈4.9e-4', '≈3.9e-3'],
              ['Best for', 'baseline', 'precision + range ok', 'wide dynamic range'],
            ].map(([prop, fp32, fp16, bf16]) => (
              <tr key={prop} className="hover:bg-white/5 transition-colors">
                <td className="py-2.5 pr-6 text-white font-bold">{prop}</td>
                <td className="py-2.5 pr-6 text-unsafe font-bold">{fp32}</td>
                <td className="py-2.5 pr-6 text-safe font-bold">{fp16}</td>
                <td className="py-2.5 text-warn font-bold">{bf16}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
