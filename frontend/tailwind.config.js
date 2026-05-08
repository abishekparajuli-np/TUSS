module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bio-dark': '#050d1a',
        'bio-surface': '#0a1628',
        'bio-teal': '#00ffc8',
        'bio-blue': '#0080ff',
        'bio-danger': '#ff4b6e',
        'bio-success': '#00e676',
        'bio-text': '#e0f7fa',
        'bio-muted': '#546e7a',
      },
      fontFamily: {
        mono: "'IBM Plex Mono', monospace",
        sans: "'Inter', sans-serif",
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
