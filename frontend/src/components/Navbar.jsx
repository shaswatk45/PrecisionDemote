import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl bg-surface-900/75">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-safe via-accent to-unsafe flex items-center justify-center text-sm font-bold shadow-glow-accent">
            16
          </div>
          <span className="font-bold text-lg tracking-tight">
            Precision<span className="text-gradient">Demote</span>
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {[
            { path: '/', label: 'Home' },
            { path: '/analysis', label: 'Analyze' },
          ].map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${pathname === path ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {pathname === path && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-lg bg-accent/20 border border-accent/30"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative">{label}</span>
            </Link>
          ))}

          <a
            href="https://clang.llvm.org/docs/LibTooling.html"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-sm ml-2 hidden sm:inline-flex"
          >
            Docs
          </a>
        </nav>
      </div>
    </header>
  )
}
