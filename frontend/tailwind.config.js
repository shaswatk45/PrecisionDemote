/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Barlow is the closest open-weight match to NVIDIA-EMEA
        sans: ['Barlow', 'Arial', 'Helvetica', 'sans-serif'],
        condensed: ['Barlow Condensed', 'Arial Narrow', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      colors: {
        // NVIDIA design system surfaces
        surface: {
          dark:     '#000000',   // hero, nav, footer
          elevated: '#1a1a1a',   // nested dark panels
          soft:     '#111111',   // subtle alt rows
          card:     '#0d0d0d',   // card background on dark
        },
        // NVIDIA Green — the single brand accent
        nv: {
          DEFAULT:  '#76b900',
          dark:     '#5a8d00',
          pale:     '#bff230',
        },
        // Hairlines
        line: {
          DEFAULT: '#2a2a2a',   // card borders on dark
          strong:  '#3d3d3d',   // stronger dividers
          light:   '#1e1e1e',   // subtlest separator
        },
        // Text roles
        ink:    '#ffffff',         // primary text on dark
        body:   'rgba(255,255,255,0.85)',  // body copy
        mute:   'rgba(255,255,255,0.55)', // metadata
        stone:  'rgba(255,255,255,0.35)', // disabled
        // Semantic (preserved for analysis meaning)
        safe:   '#14b8a6',
        unsafe: '#f43f5e',
        warn:   '#f59e0b',
      },
      borderRadius: {
        // NVIDIA angular system — 2px max on interactive elements
        none: '0px',
        xs:   '1px',
        sm:   '2px',
        DEFAULT: '2px',
        md:   '2px',
        lg:   '2px',
        // Only circles for avatars/icons
        full: '9999px',
      },
      spacing: {
        // 8px base rhythm from NVIDIA spec
        xxs: '2px',
        xs:  '4px',
        sm:  '8px',
        md:  '12px',
        lg:  '16px',
        xl:  '24px',
        xxl: '32px',
        section: '64px',
      },
      boxShadow: {
        // NVIDIA uses almost no shadow — only sticky chrome gets one
        nav:        '0 1px 0 0 #2a2a2a',
        'nv-glow':  '0 0 20px rgba(118,185,0,0.25)',
        'safe-glow':'0 0 16px rgba(20,184,166,0.28)',
        'keep-glow':'0 0 16px rgba(244,63,94,0.25)',
        none: 'none',
      },
      backgroundImage: {
        // Minimal — NVIDIA doesn't use decorative gradients
        'hero-vignette': 'linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
      },
      animation: {
        'scan':      'scan 2.8s ease-in-out infinite',
        'float':     'float 5s ease-in-out infinite',
        'pulse-slow':'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
