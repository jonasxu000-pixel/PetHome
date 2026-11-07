import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: 'var(--bg-surface-0)',
          1: 'var(--bg-surface-1)',
          2: 'var(--bg-surface-2)',
        },
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
        },
        sage: {
          50: 'var(--sage-50)',
          200: 'var(--sage-200)',
          400: 'var(--sage-400)',
          600: 'var(--sage-600)',
          700: 'var(--sage-700)',
        },
        ink: {
          900: 'var(--ink-900)',
          700: 'var(--ink-700)',
          500: 'var(--ink-500)',
          400: 'var(--ink-400)',
        },
        line: {
          100: 'var(--line-100)',
          200: 'var(--line-200)',
        },
        state: {
          sleeping: 'var(--state-sleeping)',
          'sleeping-bg': 'var(--state-sleeping-bg)',
          walking: 'var(--state-walking)',
          'walking-bg': 'var(--state-walking-bg)',
          eating: 'var(--state-eating)',
          'eating-bg': 'var(--state-eating-bg)',
          playing: 'var(--state-playing)',
          'playing-bg': 'var(--state-playing-bg)',
          unknown: 'var(--state-unknown)',
          'unknown-bg': 'var(--state-unknown-bg)',
          failed: 'var(--state-failed)',
          'failed-bg': 'var(--state-failed-bg)',
          offline: 'var(--state-offline)',
          'offline-bg': 'var(--state-offline-bg)',
        },
        semantic: {
          ok: 'var(--semantic-ok)',
          warn: 'var(--semantic-warn)',
          danger: 'var(--semantic-danger)',
          info: 'var(--semantic-info)',
        },
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        1: 'var(--sh-1)',
        2: 'var(--sh-2)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"HarmonyOS Sans SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
