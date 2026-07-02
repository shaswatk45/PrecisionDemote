import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie
} from 'recharts'
import { motion } from 'framer-motion'
import ScoreGauge from './ScoreGauge'

const COLORS = {
  fp16: '#14b8a6',
  bf16: '#f59e0b',
  keep: '#f43f5e',
  accent: '#6366f1',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass px-3 py-2 text-xs space-y-1">
      {label && <p className="text-gray-400">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

const fmtErr = (e) => (e > 0 ? `${(e * 100).toFixed(3)}%` : '0%')

export default function MetricsPanel({ metrics }) {
  if (!metrics) return null

  const {
    totalFloatVars, fp16Count = 0, bf16Count = 0, keptFloatCount = 0,
    demotionRate, memorySavedPercent, avgSafetyScore = 0,
    maxErrorBound = 0, estimatedSpeedup = 1, bytesSaved = 0,
  } = metrics

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
    ['Est. speedup', `${estimatedSpeedup}×`, 'bandwidth-bound roofline', 'text-accent-light'],
    ['Memory saved', `${memorySavedPercent}%`, `${bytesSaved} bytes/invocation`, 'text-safe'],
    ['Max rel. error', fmtErr(maxErrorBound), 'worst-case demoted var', 'text-warn'],
    ['Demotion rate', `${demotionRate}%`, `${fp16Count + bf16Count}/${totalFloatVars} narrowed`, 'text-accent-light'],
  ]

  return (
    <div className="space-y-6">
      {/* Hero row: gauge + headline stats */}
      <div className="grid lg:grid-cols-[auto_1fr] gap-6 items-center">
        <div className="glass p-6 flex flex-col items-center gap-2">
          <ScoreGauge value={avgSafetyScore} sublabel="avg score" />
          <p className="text-xs text-gray-500 text-center max-w-[10rem]">Mean demotion-safety confidence across all float variables</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {stats.map(([label, value, sub, color], i) => (
            <motion.div
              key={label}
              className="metric-card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <span className="section-title mb-0">{label}</span>
              <span className={`text-3xl font-extrabold ${color}`}>{value}</span>
              <span className="text-xs text-gray-500">{sub}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass p-6">
          <p className="section-title">Target type breakdown</p>
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

        <div className="glass p-6">
          <p className="section-title">Variables by target</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 8 }}>
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {barData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass p-6 overflow-auto">
        <p className="section-title">FP32 vs FP16 vs BF16</p>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
              <th className="pb-3 pr-6">Property</th>
              <th className="pb-3 pr-6 text-unsafe">FP32</th>
              <th className="pb-3 pr-6 text-safe">FP16</th>
              <th className="pb-3 text-warn">BF16</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[
              ['Bit width', '32', '16', '16'],
              ['Exponent bits', '8', '5', '8'],
              ['Mantissa bits', '23', '10', '7'],
              ['Max finite', '±3.4e38', '±65504', '±3.4e38'],
              ['Unit roundoff', '≈6e-8', '≈4.9e-4', '≈3.9e-3'],
              ['Best for', 'baseline', 'precision + range ok', 'wide dynamic range'],
            ].map(([prop, fp32, fp16, bf16]) => (
              <tr key={prop} className="hover:bg-white/5 transition-colors">
                <td className="py-2.5 pr-6 text-gray-300 font-medium">{prop}</td>
                <td className="py-2.5 pr-6 text-unsafe font-mono">{fp32}</td>
                <td className="py-2.5 pr-6 text-safe font-mono">{fp16}</td>
                <td className="py-2.5 text-warn font-mono">{bf16}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
