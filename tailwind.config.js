/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base: black & white
        brand: {
          black: '#0a0a0a',
          white: '#fafafa',
        },
        // Orange accent (primary actions, active states, focus)
        accent: {
          DEFAULT: '#ea580c',
          light: '#f97316',
          dark: '#c2410c',
        },
      },
    },
  },
  plugins: [],
} 