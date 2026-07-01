/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Liquid glass: surfaces are translucent whites layered over the
        // ambient gradient backdrop (see body background in index.css).
        surface: {
          DEFAULT: '#eef0f6',
          1: 'rgba(255,255,255,0.65)',
          2: 'rgba(255,255,255,0.5)',
          3: 'rgba(127,138,160,0.16)',
        },
        brand: {
          DEFAULT: '#7c3aed',
          light: '#8b5cf6',
          dim: 'rgba(124,58,237,0.12)',
        },
        accent: '#2563eb',
        border: 'rgba(255,255,255,0.55)',
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
