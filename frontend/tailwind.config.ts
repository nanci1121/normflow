import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0f4ff',
          100: '#dde8ff',
          200: '#c3d4ff',
          300: '#9db8ff',
          400: '#7090ff',
          500: '#4f6ef7',
          600: '#3b50eb',
          700: '#2f3fd0',
          800: '#2b38a8',
          900: '#293585',
          950: '#1a2057',
        },
      },
    },
  },
  plugins: [],
}

export default config
