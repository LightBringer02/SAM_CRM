module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {},
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
