/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        steel: {
          900: 'var(--steel-900)',
          800: 'var(--steel-800)',
          700: 'var(--steel-700)',
        },
        ink: 'var(--ink)',
        hairline: 'var(--hairline)',
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        accent: {
          DEFAULT: 'var(--accent)',
          600: 'var(--accent-600)',
          tint: 'var(--accent-tint)',
          dark: 'var(--accent-600)',
        },
        pos: 'var(--pos)',
        neg: 'var(--neg)',
        slate: {
          400: 'var(--slate-400)',
          600: 'var(--slate-600)',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        mono: [['Manrope', 'system-ui', '-apple-system', 'sans-serif'], { fontVariantNumeric: 'tabular-nums' }],
      },
      borderRadius: {
        ot: 'var(--radius)',
        'ot-sm': 'var(--radius-sm)',
      },
      boxShadow: {
        whisper: 'var(--shadow)',
      },
    },
  },
  plugins: [],
}
