/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette is driven by CSS variables defined in src/index.css (:root),
        // so the whole theme can be changed — or a light mode added — in one
        // place. Brand/accent use channel triplets so Tailwind opacity
        // modifiers (brand/30, to-accent/20, …) still resolve.
        // surface = an OPAQUE, theme-aware base (used as full-screen modal/page
        // backgrounds and avatar fills). surface-1/2/3 are subtle elevated
        // tints via --line (white-alpha in dark, black-alpha in light).
        surface: {
          DEFAULT: 'var(--bg)',
          1: 'rgb(var(--line) / 0.05)',
          2: 'rgb(var(--line) / 0.08)',
          3: 'rgb(var(--line) / 0.12)',
        },
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          light: 'rgb(var(--c-brand-light) / <alpha-value>)',
          dim: 'rgb(var(--c-brand) / 0.16)',
        },
        // Gradient partner — deeper coral, so from-brand→accent runs a warm ramp.
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        // Secondary warm tokens: sage = presence/positive, amber = sparks.
        sage: 'rgb(var(--c-sage) / <alpha-value>)',
        amber: 'rgb(var(--c-amber) / <alpha-value>)',
        // Semantic text + hairline tokens that flip between light & dark.
        // ink = primary text, ink-soft = secondary, muted = tertiary,
        // line = theme-aware hairline/overlay (black-alpha in light, white in dark).
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
        },
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        border: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
