/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark neon: surfaces are translucent whites layered over the deep
        // purple-black backdrop (see body background in index.css).
        surface: {
          DEFAULT: '#0a0510',
          1: 'rgba(255,255,255,0.05)',
          2: 'rgba(255,255,255,0.08)',
          3: 'rgba(255,255,255,0.12)',
        },
        brand: {
          DEFAULT: '#a855f7',
          light: '#c084fc',
          dim: 'rgba(168,85,247,0.16)',
        },
        // Gradient partner — magenta, so from-brand→accent runs violet→magenta.
        accent: '#d946ef',
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
