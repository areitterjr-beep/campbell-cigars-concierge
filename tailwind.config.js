/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cigar-brown': '#4A3728',
        'cigar-gold': '#D4A43A',
        'cigar-cream': '#F5F0E6',
        'cigar-dark': '#2C1810',
        'cigar-amber': '#B8860B',
      },
    },
  },
  plugins: [],
}
