/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface: {
          50:  '#111827',
          100: '#0f172a',
          900: '#05070d',
          800: '#0a0e17',
          700: '#111725',
          600: '#1a2235',
        },
        // Brand primary — indigo, kept distinct from the semantic red "unsafe"
        // so a call-to-action never reads as a warning.
        accent: {
          DEFAULT: '#6366f1',
          light:   '#818cf8',
          dark:    '#4f46e5',
        },
        // Semantic colors — unified with the charts (MetricsPanel) and the
        // CodeDiff FP16 highlight, which were already teal / rose.
        safe:   '#14b8a6', // demotable -> __fp16
        unsafe: '#f43f5e', // kept at float
        warn:   '#f59e0b',
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(ellipse at 60% 0%, #1e1b4b 0%, #05070d 60%)',
        'card-gradient': 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(20,184,166,0.05) 100%)',
      },
      boxShadow: {
        'glow-accent': '0 0 24px rgba(99,102,241,0.35)',
        'glow-safe':   '0 0 16px rgba(20,184,166,0.32)',
        'glow-unsafe': '0 0 16px rgba(244,63,94,0.3)',
      },
    },
  },
  plugins: [],
}
