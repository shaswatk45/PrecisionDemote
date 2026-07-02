import { motion } from 'framer-motion'

export default function ExamplesGallery({ examples, onPick }) {
  if (!examples?.length) return null
  return (
    <div className="glass p-5 space-y-3">
      <p className="section-title mb-2">Example kernels</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {examples.map((ex, i) => (
          <motion.button
            key={ex.id}
            onClick={() => onPick(ex.code)}
            className="text-left glass-hover p-3 group"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="text-sm font-semibold text-white group-hover:text-accent-light transition-colors">{ex.title}</div>
            <div className="text-xs text-gray-500 mt-0.5">{ex.blurb}</div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
