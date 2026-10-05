/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1F1A2B',
        paper: '#F5F3F7',
        line: '#E2DDE8',
        beam: '#F2B84B',
        velvet: { DEFAULT: '#7C2142', dark: '#5E1832', light: '#F6E9EE' },
        seat: {
          available: '#E9E4F0',
          booked: '#BDB7C7',
          recommended: '#12906B',
          selected: '#2F6FEB',
          standard: '#9A93A8',
          premium: '#C58A1B',
          recliner: '#7C2142',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
