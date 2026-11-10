import type { Config } from 'tailwindcss';

// Paleta e tipografia herdadas do DRAP Fazenda (tailwind.config.ts de
// fazenda-app): papel/osso, tinta, folha e terra. Os tons "warn" e "alert"
// são novos, para carência, atraso e superlotação.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper:  '#F3F1EA',
        bone:   '#FFFFFF',
        ink:    '#151A14',
        muted:  '#5A5A54',
        leaf:   '#486B3A',
        leafDk: '#2F4A27',
        leafLt: '#DFE7D6',
        earth:  '#7A5C3B',
        earthLt:'#EADFCE',
        rule:   '#D9D3C5',
        warn:   '#9A6B12',
        warnLt: '#F4E7C8',
        alert:  '#A4372A',
        alertLt:'#F3DCD6',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans:    ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        wide2: '0.14em',
      },
      boxShadow: {
        card: '0 1px 2px rgba(21,26,20,0.04), 0 12px 28px -22px rgba(21,26,20,0.18)',
      },
      maxWidth: {
        reading: '62rem',
        wide: '76rem',
      },
    },
  },
  plugins: [],
};

export default config;
