import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        priority: {
          low: '#64748b',
          medium: '#0284c7',
          high: '#ea580c',
          critical: '#dc2626',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
