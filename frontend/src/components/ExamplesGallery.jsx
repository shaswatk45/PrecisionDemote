import { motion } from 'framer-motion'

export default function ExamplesGallery({ examples, onPick }) {
  if (!examples?.length) return null
  return (
    <div className="nv-panel p-5 space-y-3 relative">
      <div className="corner-square opacity-60" />
      <p className="text-xs font-bold uppercase tracking-widest text-nv mb-2">Example computational kernels</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {examples.map((ex, i) => (
          <motion.button
            key={ex.id}
            onClick={() => onPick(ex.code)}
            className="text-left nv-panel-hover p-3 group rounded-sm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-white group-hover:text-nv transition-colors">{ex.title}</div>
            <div className="text-[11px] text-mute mt-0.5 uppercase tracking-wide font-mono">{ex.blurb}</div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
