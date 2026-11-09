/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#ec1c24',
          dark: '#c5141b',
          deep: '#8f0f14',
          soft: '#fdecec',
        },
        ink: {
          DEFAULT: '#1E1E1E',
          soft: '#33343a',
        },
        mist: '#F8F9FA',
        prime: '#a95e6b',
        crown: '#447a72',
        elora: '#4A90E2',
        power: '#ec1c24',
      },
      boxShadow: {
        soft: '0 10px 40px -18px rgba(20, 20, 25, 0.25)',
        card: '0 2px 10px -4px rgba(20, 20, 25, 0.12), 0 18px 50px -30px rgba(20, 20, 25, 0.28)',
        glow: '0 18px 50px -24px rgba(236, 28, 36, 0.55)',
      },
      backgroundImage: {
        'mesh-brand':
          'radial-gradient(1200px 500px at 100% -10%, rgba(236,28,36,.18), transparent 60%), radial-gradient(900px 420px at 0% 0%, rgba(68,122,114,.16), transparent 55%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'grow-x': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.16,1,.3,1) both',
        'fade-in': 'fade-in .3s ease-out both',
        'slide-in': 'slide-in .35s cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
};
