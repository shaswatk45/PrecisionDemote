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
          50:  '#2a0a0a',
          100: '#1f0808',
          900: '#000000',
          800: '#0a0a0a',
          700: '#121212',
          600: '#1a1a1a',
        },
        accent: {
          DEFAULT: '#ef4444',
          light:   '#f87171',
          dark:    '#dc2626',
        },
        safe:   '#e5e5e5',
        unsafe: '#991b1b',
        warn:   '#f59e0b',
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(ellipse at 60% 0%, #3f000f 0%, #000000 60%)',
        'card-gradient': 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(229,229,229,0.05) 100%)',
      },
      boxShadow: {
        'glow-accent': '0 0 24px rgba(239,68,68,0.35)',
        'glow-safe':   '0 0 16px rgba(229,229,229,0.3)',
        'glow-unsafe': '0 0 16px rgba(153,27,27,0.3)',
      },
    },
  },
  plugins: [],
}
