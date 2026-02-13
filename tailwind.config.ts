/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',          // ← important: 'class' strategy (not 'media')
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}