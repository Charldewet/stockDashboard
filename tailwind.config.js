/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // AIFlow Design System Colors
        'bg-gradient': {
          from: '#111827',
          to: '#0F172A'
        },
        'surface': {
          primary: '#1F2937',
          secondary: '#111827'
        },
        'text': {
          primary: '#F9FAFB',
          secondary: '#9CA3AF'
        },
        'accent': {
          primary: '#FF4500',
          'primary-hover': '#E63E00',
          'primary-focus': '#FFA500',
          'secondary-blue': '#3B82F6',
          'secondary-purple': '#8B5CF6'
        },
        'status': {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444'
        },
        'cost-sales': '#A0FC4E',
        'border': '#374151',
        'input': {
          bg: '#374151',
          border: '#4B5563'
        },
        // Chart Colors
        'chart': {
          coquelicot: '#FF4509',
          gold: '#FFD600',
          'electric-purple': '#B200FF',
          chartreuse: '#7FFF00',
          white: '#FFFFFF'
        }
      },
      fontFamily: {
        'sans': ['fieldwork', 'fieldwork-hum', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif']
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
} 