/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        brand: {
          50: '#f2f1ff',
          100: '#e9e6ff',
          200: '#d6d0ff',
          300: '#b8adff',
          400: '#9583ff',
          500: '#7862f4',
          600: '#6847e8',
          700: '#5836cc',
          800: '#4930a6',
          900: '#3d2b84',
          950: '#241a54',
        },
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      opacity: {
        15: '0.15',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        85: '0.85',
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 22, 34, 0.03), 0 18px 46px -28px rgba(27, 25, 64, 0.22)',
        float: '0 28px 80px -30px rgba(45, 33, 110, 0.34), 0 2px 8px rgba(20, 22, 34, 0.03)',
        button: '0 12px 28px -12px rgba(104, 71, 232, 0.7)',
        qr: '0 22px 60px -24px rgba(44, 35, 102, 0.3)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-9px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '80%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        scan: {
          '0%': { top: '7%', opacity: '0' },
          '12%': { opacity: '1' },
          '88%': { opacity: '1' },
          '100%': { top: '91%', opacity: '0' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.5s ease-out both',
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        scan: 'scan 3.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        shimmer: 'shimmer 2.2s ease-in-out infinite',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
