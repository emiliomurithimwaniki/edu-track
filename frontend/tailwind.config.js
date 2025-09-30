/********************
Tailwind Config
********************/ 
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'],
      },
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#b7d6ff',
          300: '#8bbcff',
          400: '#5d9bff',
          500: '#3b82f6',
          600: '#2f6bd9',
          700: '#2957b6',
          800: '#274b94',
          900: '#223e76',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(16, 24, 40, 0.05), 0 1px 3px 0 rgba(16, 24, 40, 0.1)',
        card: '0 1px 2px 0 rgba(16, 24, 40, 0.04), 0 8px 24px -8px rgba(16, 24, 40, 0.1)',
        elevated: '0 10px 25px -5px rgba(16, 24, 40, 0.15), 0 8px 10px -6px rgba(16, 24, 40, 0.1)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
