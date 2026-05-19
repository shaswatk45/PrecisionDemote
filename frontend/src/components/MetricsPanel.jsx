import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie
} from 'recharts'
import { motion } from 'framer-motion'

const COLORS = {
  safe: '#14b8a6',
  unsafe: '#f43f5e',
  neutral: '#6366f1',
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

export default function MetricsPanel({ metrics }) {
  if (!metrics) return null

  const { totalFloatVars, safeCount, unsafeCount, demotionRate, estimatedMaxRelError, memorySavedPercent } = metrics
  const pieData = [
    { name: 'FP16-safe', value: safeCount },
    { name: 'Keep FP32', value: unsafeCount },
  ]
  const barData = [
    { name: 'Total', value: totalFloatVars, fill: COLORS.neutral },
    { name: 'FP16', value: safeCount, fill: COLORS.safe },
    { name: 'FP32', value: unsafeCount, fill: COLORS.unsafe },
  ]
  const stats = [
    ['Demotion Rate', `${demotionRate}%`, 'of float vars safely demoted', 'text-safe'],
    ['Max Relative Error', estimatedMaxRelError > 0 ? `~${(estimatedMaxRelError * 100).toFixed(2)}%` : '0%', 'for demoted variables', 'text-warn'],
    ['Memory Saved', `~${memorySavedPercent}%`, 'in float storage footprint', 'text-accent-light'],
    ['Variables Analyzed', totalFloatVars, `${safeCount} safe / ${unsafeCount} kept`, 'text-gray-200'],
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(([label, value, sub, color], i) => (
          <motion.div
            key={label}
            className="metric-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <span className="section-title mb-0">{label}</span>
            <span className={`text-3xl font-extrabold ${color}`}>{value}</span>
            <span className="text-xs text-gray-500">{sub}</span>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass p-6">
          <p className="section-title">Demotion breakdown</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((entry, i) => <Cell key={entry.name} fill={i === 0 ? COLORS.safe : COLORS.unsafe} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass p-6">
          <p className="section-title">Variable counts</p>
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
        <p className="section-title">FP16 vs FP32 comparison</p>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
              <th className="pb-3 pr-6">Property</th>
              <th className="pb-3 pr-6 text-unsafe">FP32</th>
              <th className="pb-3 text-safe">FP16</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[
              ['Bit width', '32 bits', '16 bits'],
              ['Exponent bits', '8', '5'],
              ['Mantissa bits', '23', '10'],
              ['Decimal digits', '~7.2', '~3.3'],
              ['Range', '+/-3.4e38', '+/-6.5e4'],
              ['Memory per var', '4 bytes', '2 bytes'],
            ].map(([prop, fp32, fp16]) => (
              <tr key={prop} className="hover:bg-white/5 transition-colors">
                <td className="py-2.5 pr-6 text-gray-300 font-medium">{prop}</td>
                <td className="py-2.5 pr-6 text-unsafe font-mono">{fp32}</td>
                <td className="py-2.5 text-safe font-mono">{fp16}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
