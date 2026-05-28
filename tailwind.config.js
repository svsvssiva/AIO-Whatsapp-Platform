/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        system: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
