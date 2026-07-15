import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: 'var(--color-obsidian)',
        ink: {
          DEFAULT: 'var(--color-ink)',
          glow: 'var(--color-ink-glow)',
          muted: 'var(--color-ink-muted)',
        },
        bone: {
          DEFAULT: 'var(--color-bone)',
          muted: 'var(--color-bone-muted)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      boxShadow: {
        ink: '0 0 4rem var(--color-ink-glow)',
      },
    },
  },
  plugins: [],
} satisfies Config
