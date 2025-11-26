/** @type {import('tailwindcss').Config} */
module.exports = {
  safelist: [
    'bg-background',
    'bg-background-secondary',
    'bg-background-tertiary',
    'text-text-primary',
    'text-text-secondary',
    'text-text-tertiary',
    'ring-primary',
  ],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#121212',
          secondary: '#1A1A1A',
          tertiary: '#2A2A2A',
        },
        primary: {
          DEFAULT: '#8B5CF6',  // Violet-500 color
          light: '#A78BFA',
          dark: '#7C3AED',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#B3B3B3',
          tertiary: '#727272',
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
