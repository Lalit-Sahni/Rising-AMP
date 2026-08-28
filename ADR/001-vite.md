# Why Vite

Create React App (`react-scripts` 5) is unmaintained. The old craco analyser config was broken and unused. Vite is the current, boring way to build a React app: faster refresh, honest env files (`VITE_*`), and a bundle we can actually measure.

Localhost still loads `.env.local` (staging). Production builds load `.env.production.local`. Those files must never be swapped.
