const { fontFamily } = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#02040a", // Even deeper obsidian for better contrast
        foreground: "#F8FAFC", // Ghost White
        obsidian: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0b1221", // Darker glass surface
          950: "#02040a", // Deeper obsidian
        },
        faheem: {
          emerald: "#10B981",
          sky: "#38BDF8",
          rose: "#F43F5E",
          purple: "#A855F7",
          orange: "#F97316",
        },
        ai: {
          ready: "#64748B",
          listening: "#F43F5E",
          seeing: "#A855F7",
          thinking: "#38BDF8",
          speaking: "#10B981",
          interrupted: "#F97316",
          error: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...fontFamily.mono],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "orb-float": "orb-float 6s ease-in-out infinite",
        "ripple": "ripple 2s cubic-bezier(0, 0.2, 0.8, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
        "wave": "wave 1.2s ease-in-out infinite",
      },
      keyframes: {
        "orb-float": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-15px) scale(1.05)" },
        },
        ripple: {
          "0%": { transform: "scale(0.8)", opacity: "0.5" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.5)" },
          "50%": { transform: "scaleY(1.5)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
