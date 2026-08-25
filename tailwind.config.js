/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "ui-background": "#F8FAFC",
        "ui-border": "#E2E8F0",
        "deep-navy": "#0F172A",
        "surface-dark": "#0B132B",
        "surface-card": "#FFFFFF",
        "secondary-brand": "#0051D5",
        "secondary-container": "#316BF3",
        "status-pass": "#15803D",
        "status-warning": "#D97706",
        "status-fail": "#B91C1C",
        "status-info": "#475569",
        "surface-tint": "#565E74",
        "primary": "#0F172A",
        "on-surface": "#0B1C30",
        "on-surface-variant": "#64748B",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        headline: ["IBM Plex Sans", "Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
    },
  },
  plugins: [],
};
