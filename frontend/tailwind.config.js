module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Theme colors using CSS variables set by ThemeProvider
        theme: {
          base: 'var(--theme-base)',
          surface: 'var(--theme-surface)',
          'surface-alt': 'var(--theme-surface-alt)',
          primary: 'var(--theme-primary)',
          'primary-hover': 'var(--theme-primary-hover)',
          accent: 'var(--theme-accent)',
          text: 'var(--theme-text)',
          'text-muted': 'var(--theme-text-muted)',
          border: 'var(--theme-border)',
        }
      }
    },
  },
  plugins: [],
    // PDF/Canvas compatibility: force color output to rgb/hsl/hex only
    future: {
      // This disables the new color system that outputs oklch/oklab
      useOkLCH: false,
    },
    experimental: {
      optimizeUniversalDefaults: false,
    },
  }
