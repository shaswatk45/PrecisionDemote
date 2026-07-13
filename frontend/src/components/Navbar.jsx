import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-50 border-b bg-surface-dark border-line h-16"
      style={{
        boxShadow: '0 1px 0 0 #2a2a2a',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div
            className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold text-black transition-all duration-200 group-hover:bg-nv-dark bg-nv"
          >
            16
          </div>
          <span className="font-bold text-lg tracking-tight uppercase font-sans">
            Precision<span className="text-nv">Demote</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 flex-wrap">
          {[
            { path: '/', label: 'Home' },
            { path: '/workspace', label: 'Workspace' },
            { path: '/visualizer', label: 'Dependency Graph' },
            { path: '/step-by-step', label: 'Step By Step' },
            { path: '/metrics', label: 'Metrics' },
            { path: '/simulator', label: 'Simulator' },
            { path: '/ppt', label: 'Project PPT' },
            { path: '/docs', label: 'Compiler Docs' },
          ].map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`relative px-3 py-1.5 rounded-sm text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                pathname === path
                  ? 'text-white'
                  : 'text-mute hover:text-white hover:bg-white/5'
              }`}
            >
              {pathname === path && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-sm"
                  style={{
                    background: 'rgba(118, 185, 0, 0.1)',
                    border: '1px solid #76b900',
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
