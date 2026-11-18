/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marca: {
          50: '#fbf2f3',
          100: '#f6e1e4',
          200: '#ecc3c9',
          500: '#b23a4b',
          600: '#8f1d2c', // color principal LOMUS
          700: '#771826',
          800: '#5e1320',
        },
        fondo: '#faf7f5',
        tinta: { DEFAULT: '#1f1a1b', suave: '#5b5254', tenue: '#8a8183' },
        // Niveles de riesgo (siempre acompañar de ícono + texto)
        riesgo: {
          vencido: '#1f1a1b',
          emergencia: '#c62828',
          critico: '#e8590c',
          medio: '#e0a800',
          ok: '#2e7d32',
        },
        ok: { DEFAULT: '#2e7d32', bg: '#e8f5e9' },
        aviso: { DEFAULT: '#a15c00', bg: '#fff4e0' },
        error: { DEFAULT: '#c62828', bg: '#fdecea' },
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: { tarjeta: '0 1px 2px rgba(31,26,27,.06), 0 4px 16px rgba(31,26,27,.06)' },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
