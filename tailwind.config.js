// Preset da Indikei (design-system/tokens/tailwind.config.js) + cores de apoio usadas no site
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'monospace'] },
      colors: {
        verde: { 50: '#ECF8F1', 100: '#D3F0E0', 200: '#A6E1C2', 300: '#34D186', 500: '#1DB56B', 600: '#0F9D58', 700: '#0A7F47', 900: '#053D23' },
        ink: { 50: '#F5F7F6', 100: '#ECF0EE', 200: '#DCE2DF', 300: '#B9C4BF', 400: '#8A9590', 600: '#4E5B56', 800: '#24302C', 950: '#0E1714' },
        ambar: { fg: '#9A5B00', bg: '#FFF3D6', solid: '#F2A516' },
        vermelho: { fg: '#B3372F', bg: '#FCEAE8', solid: '#E2574C' },
        azul: { fg: '#1F5BBF', bg: '#E7EFFC', solid: '#3B7BE8' },
        laranja: { fg: '#B4480B', bg: '#FFF0E6' },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        border: 'var(--border)',
        ring: 'var(--ring)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        float: '0 2px 4px rgba(14,23,20,.05), 0 18px 48px rgba(14,23,20,.16)',
        dark: '0 18px 48px rgba(14,23,20,.2)',
        verde: '0 10px 30px rgba(15,157,88,.28)',
      },
    },
  },
}
