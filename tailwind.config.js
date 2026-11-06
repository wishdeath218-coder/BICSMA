/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Mirrors src/constants/colors.ts so the design stays identical
        primary: '#00193c',
        'primary-light': '#002d62',
        blue: '#115cb9',
        'blue-light': '#eef4fd',
        purple: '#5c3188',
        'purple-light': '#f8f3fc',
        red: '#ba1a1a',
        'red-light': '#fef2f2',
        amber: '#b45309',
        'amber-light': '#fffbeb',
        green: '#15803d',
        'green-light': '#f0fdf4',
        gray: '#43474f',
        'gray-light': '#f3f4f6',
        border: '#c4c6d1',
        muted: '#6b7280',
        ink: '#151c22',
        canvas: '#f5f7fa',
        // ─── Dark-mode tones (used via dark: variants) ───
        'canvas-dark': '#0f1216',
        'surface-dark': '#1a1f26',
        'surface-dark-2': '#252a31',
        'border-dark': '#3a4048',
        'ink-dark': '#e6e9ee',
        'muted-dark': '#9aa2ad',
      },
    },
  },
  plugins: [],
};
