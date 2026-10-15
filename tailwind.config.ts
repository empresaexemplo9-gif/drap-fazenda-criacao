import type { Config } from 'tailwindcss';

// Paleta e tipografia herdadas do DRAP Fazenda (tailwind.config.ts de
// fazenda-app): papel/osso, tinta, folha e terra. Os tons "warn" e "alert"
// são novos, para carência, atraso e superlotação.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper:  '#F7F4EC',
        bone:   '#FBFAF5',
        ink:    '#111410',
        muted:  '#5A5A54',
        leaf:   '#486B3A',
        leafDk: '#2F4A27',
        leafLt: '#DFE7D6',
        earth:  '#7A5C3B',
        earthLt:'#EADFCE',
        rule:   '#C8C2B2',
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
        card: '0 1px 0 rgba(17,20,16,0.04), 0 8px 24px -16px rgba(17,20,16,0.08)',
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
