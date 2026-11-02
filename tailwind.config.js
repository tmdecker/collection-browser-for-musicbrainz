/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#121212',
          secondary: '#1A1A1A',
          tertiary: '#2A2A2A',
          control: '#1E1E1E', // Resting fill of the round header controls and the search field (used at /75)
        },
        primary: {
          DEFAULT: '#8B5CF6',  // Violet-500 color
          light: '#A78BFA',
          dark: '#7C3AED',
        },
        // Selected filter chips and the active filter tab, one per category; dark enough for white text (4.5:1+)
        category: {
          label: '#E11D48', // rose-600
          tag: '#C2410C', // orange-700
          date: '#C026D3', // fuchsia-600
          rating: '#B45309', // amber-700
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#B3B3B3',
          tertiary: '#8A8A8A',
        },
      },
      gridTemplateColumns: {
        'album-grid': 'repeat(auto-fill, minmax(115px, 1fr))',
        'album-grid-tablet': 'repeat(auto-fill, minmax(140px, 1fr))',
        'album-grid-desktop': 'repeat(auto-fill, minmax(180px, 1fr))',
      },
      spacing: {
        'album-card': '180px',
      },
      zIndex: {
        '15': '15',
        '25': '25',
      },
    },
  },
  plugins: [],
}
